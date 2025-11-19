import { Request } from 'express';
import { CurrentUserData } from '../decorators/current-user.decorator';

export interface RequestWithUser extends Request {
  user: CurrentUserData;
}
