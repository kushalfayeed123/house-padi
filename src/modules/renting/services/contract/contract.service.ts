import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { AiService } from 'src/common/ai.service';
import { StorageService } from 'src/common/storage.service';

export interface ILeasePdfData {
  leaseId: string;
  ownerName: string;
  renterName: string;
  propertyTitle: string;
  amount: number;
  currency: string;
  agreementContent: string;
  address: string;
}

// src/modules/contracts/contract.service.ts

@Injectable()
export class ContractService {
  constructor(
    private readonly storageService: StorageService,
    private readonly aiService: AiService,
  ) {}

  async generateLeasePDF(data: ILeasePdfData): Promise<string> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', serif; line-height: 1.3; color: #000; font-size: 11pt; margin: 0; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; }
          .header h1 { text-transform: uppercase; font-size: 14pt; margin: 5px 0; }
          
          /* Compact Schedule Table */
          .schedule { width: 100%; border: 1px solid #000; margin-bottom: 15px; border-collapse: collapse; }
          .schedule td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
          .label { font-weight: bold; width: 120px; background-color: #f2f2f2; }

          .section-title { font-weight: bold; text-transform: uppercase; text-decoration: underline; display: block; margin-top: 10px; }
          .clause { text-align: justify; margin: 5px 0; }
          
          .sig-section { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { width: 45%; border-top: 1px solid #000; padding-top: 5px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header"><h1>Tenancy Agreement</h1></div>

        <table class="schedule">
          <tr><td class="label">DATE</td><td>${new Date().toLocaleDateString('en-GB')}</td></tr>
          <tr><td class="label">LANDLORD</td><td><strong>${data.ownerName}</strong></td></tr>
          <tr><td class="label">TENANT</td><td><strong>${data.renterName}</strong></td></tr>
          <tr><td class="label">PROPERTY</td><td><strong>${data.propertyTitle}</strong> at ${data.address}</td></tr>
          <tr><td class="label">RENT</td><td><strong>${data.currency} ${data.amount.toLocaleString()}</strong> (Per Annum)</td></tr>
        </table>

        <span class="section-title">1. THE TENANCY</span>
        <p class="clause">The Landlord lets and the Tenant takes the Property for a term of 12 months. The Tenant agrees to use the premises strictly for residential purposes and shall not assign or sublet the premises without written consent.</p>

        <span class="section-title">2. TENANT OBLIGATIONS</span>
        <p class="clause">The Tenant shall: (a) Pay rent in advance; (b) Pay all utility charges including Electricity (IKEDC/EKEDC) and Waste (LAWMA); (c) Keep the interior in good and tenantable repair; (d) Permit the Landlord to inspect the premises at reasonable hours.</p>

        <span class="section-title">3. LANDLORD OBLIGATIONS</span>
        <p class="clause">The Landlord shall: (a) Keep the external structure and roof in good repair; (b) Ensure the Tenant enjoys quiet and peaceable possession of the premises during the term.</p>

        <span class="section-title">4. LEGAL PROVISIONS</span>
        <p class="clause">If rent is in arrears for 21 days, the Landlord may re-enter. This agreement is governed by the Laws of the Federal Republic of Nigeria, and statutory notice periods apply for termination.</p>

        <div class="sig-section">
          <div class="sig-box"><strong>LANDLORD</strong><br><small>${data.ownerName}</small></div>
          <div class="sig-box"><strong>TENANT</strong><br><small>${data.renterName}</small></div>
        </div>
      </body>
      </html>
    `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

      const path = `contracts/lease_${data.leaseId}.pdf`;
      return await this.storageService.uploadFile(
        path,
        Buffer.from(pdfBuffer),
        'application/pdf',
      );
    } catch (error) {
      throw new Error(`Failed to generate compact lease ${error}`);
    } finally {
      if (browser) await browser.close();
    }
  }
}
