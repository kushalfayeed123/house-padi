/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// src/common/padi/padi.orchestrator.ts

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { PropertiesService } from '../../modules/properties/services/properties.service';
import { ProfilesService } from '../../modules/profile/profile.service';

import { PadiContext } from '../../modules/padi/interfaces/padi-logic.interface';
import { Property } from '../../modules/properties/entities/property.entity';
import { AiService } from '../../common/ai.service';
import { ChatBotService } from '../../common/chat-bot.service';
import { LeaseService } from '../renting/services/lease/lease.service';
import { TourService } from '../renting/services/tour/tour.service';
import { PadiToolName } from './interfaces/padi-tools.interface';
import { ChatHistoryService } from '../chat/services/chat-history.service';
import { CreatePropertyDto } from '../properties/dto/create-property.dto';
import { PaymentService } from '../renting/services/payment/payment.service';

@Injectable()
export class PadiOrchestrator {
  private readonly logger = new Logger(PadiOrchestrator.name);

  constructor(
    private readonly chatBotService: ChatBotService,
    private readonly propertiesService: PropertiesService,
    private readonly profilesService: ProfilesService,
    private readonly aiService: AiService,
    private readonly leaseService: LeaseService, // From lease.service.ts
    private readonly tourService: TourService, // From tour.service.ts
    private readonly chatHistoryService: ChatHistoryService,
    private readonly paymentService: PaymentService,
  ) {}

  async execute(userId: string | null, userMessage: string) {
    const history = await this.chatHistoryService.getRecentContext(userId);
    const isFirstMessage = history.length === 0;

    const userProfile = userId
      ? await this.profilesService.findOne(userId)
      : null;

    const context: PadiContext = {
      isLoggedIn: !!userId,
      userName: userProfile?.firstName || 'Client',
      kycStatus: userProfile?.kycStatus || 'UNVERIFIED',
    };
    let toolCalls: string | any[] = [];
    try {
      await this.chatHistoryService.saveMessage(userId, 'user', userMessage);
      const plan = await this.chatBotService.generateExecutionPlan(
        userMessage,
        context,
        history,
      );
      toolCalls = plan.toolCalls || [];

      let primaryData: Property[] = [];
      let secondaryData: Property[] = [];
      let finalAction = toolCalls.length > 0 ? toolCalls[0].name : 'CHAT';
      let toolPayload: any = null;

      for (const call of toolCalls) {
        const args = call.arguments as Record<string, unknown>;
        // Ensure the switch predicate and cases both use the PadiToolName enum type
        switch (call.name) {
          case PadiToolName.SEARCH_PROPERTIES: {
            const queryArg =
              typeof args.query === 'string' ? args.query : userMessage;
            const searchResult = await this.propertiesService.findAiRecommended(
              {
                chatPrompt: queryArg,
                context,
              },
            );
            primaryData = searchResult.data;
            secondaryData = searchResult.suggestions;
            break;
          }

          case PadiToolName.GET_RENTAL_STATUS:
            this.ensureAuthenticated(context);
            // Logic for lease.service.ts
            toolPayload = await this.leaseService.getUserLeases(userId!);
            break;

          case PadiToolName.START_PROPERTY_LISTING: {
            this.ensureAuthenticated(context);
            try {
              const title = (args.title ||
                args.name ||
                args.property_name) as string;
              const price = args.price || args.rent || args.amount;
              const location = (args.location ||
                args.city ||
                args.area) as string;
              const addressFull = (args.addressFull ||
                args.address ||
                args.street) as string;
              const leaseDuration = args.leaseDurationMonths || args.duration; // New field check
              const missing = [];
              if (!title) missing.push('Title');
              if (!price) missing.push('Price/Rent');
              if (!location) missing.push('City/Location');
              if (!addressFull) missing.push('Full Street Address');
              if (!leaseDuration)
                missing.push('Minimum Lease Duration (in months)');

              if (missing.length > 0) {
                // Throw an error that specifically lists the missing items
                throw new BadRequestException(`Missing: ${missing.join(', ')}`);
              }

              const createDto: CreatePropertyDto = {
                title,
                price: Number(price),
                location,
                addressFull,
                features: args.features || {},
                leaseDurationMonths: 0,
                agreementContent: '',
              };
              toolPayload = await this.propertiesService.create(
                createDto,
                userId || '',
                [],
              );
              finalAction = 'PROPERTY_CREATED';
            } catch (error: unknown) {
              // Map NestJS exceptions to toolPayload so the AI can synthesize a helpful reply
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred';
              const errorName =
                error instanceof HttpException
                  ? error.name
                  : 'InternalServerError';
              toolPayload = {
                error: errorName,
                message: errorMessage,
                actionRequired:
                  error instanceof ForbiddenException
                    ? 'KYC_VERIFICATION'
                    : 'GENERAL_ERROR',
              };
              finalAction = 'LISTING_ERROR';
            }
            break;
          }

          case PadiToolName.CREATE_APPLICATION: {
            this.ensureAuthenticated(context);
            const propertyId = args.propertyId as string;
            const tourDateValue =
              typeof args.tourDate === 'string' ||
              typeof args.tourDate === 'number'
                ? new Date(args.tourDate)
                : undefined;
            if (!propertyId || tourDateValue) {
              throw new BadRequestException(
                'Property ID or Tour Date is missing from the request.',
              );
            }
            toolPayload = await this.tourService.createApplication(
              propertyId,
              userId!,
              tourDateValue,
            );
            break;
          }

          case PadiToolName.UPDATE_APPLICATION_STATUS: {
            this.ensureAuthenticated(context);
            const applicationId = args.applicationId as string;
            const status = args.status as string;
            if (!applicationId || !status) {
              throw new BadRequestException(
                'Application ID or Status is missing from the request.',
              );
            }

            toolPayload = await this.tourService.updateApplicationStatus(
              applicationId,
              status,
              userId!,
            );
            break;
          }

          case PadiToolName.PREPARE_LEASE: {
            this.ensureAuthenticated(context);
            const applicationId = args.applicationId as string;
            if (!applicationId) {
              throw new BadRequestException(
                'Application ID  is missing from the request.',
              );
            }
            toolPayload = await this.leaseService.prepareLease(
              applicationId,
              userId!,
            );
            break;
          }

          case PadiToolName.COMPLETE_RENTAL: {
            this.ensureAuthenticated(context);
            const paymentRef = args.paymentRef as string;
            const leaseId = args.leaseId as string;
            const amount = args.amount as number;
            if (!paymentRef || !leaseId || !amount) {
              throw new BadRequestException(
                'Payment Ref ID or Lease Id or Amount is missing from the request.',
              );
            }
            toolPayload = await this.paymentService.handlePaymentWebhook(
              paymentRef,
              leaseId,
              userId!,
              amount,
            );
            break;
          }

          case PadiToolName.DECLINE_LEASE: {
            this.ensureAuthenticated(context);
            const leaseId = args.leaseId as string;
            if (!leaseId) {
              throw new BadRequestException(
                'Lease Id is missing from the request.',
              );
            }
            toolPayload = await this.leaseService.declineLease(
              leaseId,
              userId!,
            );
            break;
          }

          case PadiToolName.GET_USER_APPLICATIONS:
            this.ensureAuthenticated(context);
            toolPayload = await this.tourService.getUserApplications(userId!);
            break;

          case PadiToolName.GET_OWNER_DASHBOARD:
            this.ensureAuthenticated(context);
            // Logic to fetch properties owned by the current user[cite: 1]
            toolPayload = await this.tourService.getOwnerDashboardApplications(
              userId!,
            );
            break;

          // Add other cases using PadiToolName.[ENUM_VALUE]

          default:
            this.logger.warn(`Unrecognized tool: ${call.name}`);
        }
      }

      const professionalSummary = await this.aiService.synthesizeSearchResponse(
        userMessage,
        primaryData,
        secondaryData,
        context,
        finalAction,
        toolPayload,
        isFirstMessage, // Ensure greeting only happens once
      );

      await this.chatHistoryService.saveMessage(
        userId,
        'assistant',
        professionalSummary,
      );

      return {
        success: true,
        text: professionalSummary,
        data: primaryData,
        suggestions: secondaryData,
        toolResponse: toolPayload,
        action: finalAction,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Orchestration failure',
        error instanceof Error ? error.stack : error,
      );

      // Determine the attempted action from the toolCalls if they existed
      const attemptedAction =
        toolCalls && toolCalls.length > 0
          ? toolCalls[0].name
          : 'UNKNOWN_ACTION';

      if (error instanceof UnauthorizedException) {
        return {
          success: false,
          text: `Hello ${context.userName}, I noticed you aren't signed in. Please log in to manage your rentals.`,
          action: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        text:
          error instanceof BadRequestException
            ? error.message
            : 'I encountered a technical issue. Please try again shortly.',
        action: 'ERROR',
        timestamp: new Date().toISOString(),
        // Added fields for better insight
        details: {
          attemptedAction,
          errorType: error?.constructor?.name || 'InternalError',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private ensureAuthenticated(context: PadiContext): void {
    if (!context.isLoggedIn) {
      throw new UnauthorizedException('Authentication required.');
    }
  }
}
