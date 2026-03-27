import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Define the shape of the Supabase JWT payload
interface SupabaseJwtPayload {
  sub: string;
  email: string;
  role?: string;
  aud: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET is missing from environment');
    }

    super({
      // 1. Dynamically fetch the public key from Supabase's JWKS endpoint
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://jopoergjjwdvhvpweayh.supabase.co/auth/v1/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: 'authenticated',
      issuer: `https://jopoergjjwdvhvpweayh.supabase.co/auth/v1`,
      algorithms: ['ES256'], // Match the algorithm from your Supabase dashboard
    });
  }

  // Define return type for better downstream IntelliSense (req.user)
  validate(payload: SupabaseJwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
