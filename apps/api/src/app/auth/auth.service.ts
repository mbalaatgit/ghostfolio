import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import * as crypto from 'node:crypto';
import { JwtService } from '@nestjs/jwt';

import { ValidateOAuthLoginParams } from './interfaces/interfaces';

@Injectable()
export class AuthService {
  public constructor(
    private readonly configurationService: ConfigurationService,
    private readonly jwtService: JwtService,
    private readonly propertyService: PropertyService,
    private readonly userService: UserService
  ) {}

  public async validateAnonymousLogin(accessToken: string): Promise<string> {
    const hashedAccessToken = this.userService.createAccessToken({
      password: accessToken,
      salt: this.configurationService.get('ACCESS_TOKEN_SALT')
    });

    const [user] = await this.userService.users({
      where: { accessToken: hashedAccessToken }
    });

    if (user) {
      return this.jwtService.sign({
        id: user.id
      });
    }

    throw new Error();
  }


  public async registerLocalUser({
    password,
    username
  }: {
    password: string;
    username: string;
  }): Promise<string> {
    const existingUsers = await this.userService.users({
      where: { username }
    });

    if (existingUsers.length > 0) {
      throw new Error('Username already in use');
    }

    const passwordHash = await this.hashPassword(password);

    const user = await this.userService.createUser({
      data: { passwordHash, provider: Provider.LOCAL, username }
    });

    return this.jwtService.sign({ id: user.id });
  }

  public async validateLocalLogin({
    password,
    username
  }: {
    password: string;
    username: string;
  }): Promise<string> {
    const [user] = await this.userService.users({
      where: { provider: Provider.LOCAL, username }
    });

    if (!user?.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return this.jwtService.sign({ id: user.id });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (crypto as any).argon2Sync('argon2id', {
      memory: 65536,
      parallelism: 4,
      passes: 3,
      salt,
      tagLength: 32
    }, Buffer.from(password)) as Buffer;

    return `argon2id$${salt.toString('base64')}$${Buffer.from(derivedKey).toString('base64')}`;
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, encodedSalt, encodedTag] = passwordHash.split('$');

    if (algorithm !== 'argon2id' || !encodedSalt || !encodedTag) {
      return false;
    }

    const derivedKey = (crypto as any).argon2Sync('argon2id', {
      memory: 65536,
      parallelism: 4,
      passes: 3,
      salt: Buffer.from(encodedSalt, 'base64'),
      tagLength: 32
    }, Buffer.from(password)) as Buffer;

    return timingSafeEqual(Buffer.from(encodedTag, 'base64'), Buffer.from(derivedKey));
  }

  public async validateOAuthLogin({
    provider,
    thirdPartyId
  }: ValidateOAuthLoginParams): Promise<string> {
    try {
      let [user] = await this.userService.users({
        where: { provider, thirdPartyId }
      });

      if (!user) {
        const isUserSignupEnabled =
          await this.propertyService.isUserSignupEnabled();

        if (!isUserSignupEnabled) {
          throw new Error('Sign up forbidden');
        }

        // Create new user if not found
        user = await this.userService.createUser({
          data: {
            provider,
            thirdPartyId
          }
        });
      }

      return this.jwtService.sign({
        id: user.id
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'validateOAuthLogin',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
