/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/common/guards/optional-jwt-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to ensure it doesn't throw 401 if user is missing
  handleRequest(err: any, user: any) {
    if (err || !user) {
      return null; // Return null instead of throwing an exception
    }
    return user;
  }
}
