declare module 'passport-apple' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOptions {
    clientID: string;
    teamID: string;
    keyID: string;
    privateKeyLocation: string;
    callbackURL: string;
    scope?: string[];
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: StrategyOptions,
      verify: (
        accessToken: string,
        refreshToken: string,
        idToken: any,
        profile: any,
        done: (error: any, user?: any, info?: any) => void,
      ) => void,
    );

    name: string;
    authenticate(req: any, options?: any): void;
  }
}
