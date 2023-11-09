import { Router } from 'express';
import { userSelectSchema } from '../validator/user.ts';
import {
  buildClientErrorResponse,
  buildUnknownErrorResponse,
} from '../lib/utils.ts';
import { auth } from '../db/lucia.ts';
import { authUsekeySafe } from '../lib/safeAuth.ts';
import { INCORRECT_EMAIL_OR_PASSWORD } from '../constant/error.ts';

const router = Router();
router.post('/login', async (req, res) => {
  const userParseRes = userSelectSchema.safeParse(req.body);

  if (!userParseRes.success) {
    const formatted = userParseRes.error.format();
    if (formatted.username) {
      return buildClientErrorResponse(res, 'Invalid username');
    }
    if (formatted.password) {
      return buildClientErrorResponse(res, 'Invalid password');
    }
    if (formatted.email) {
      return buildClientErrorResponse(res, 'Invalid email');
    }
    return buildClientErrorResponse(res, 'Unknown parse error');
  }

  const { email, password } = userParseRes.data;
  const key = await authUsekeySafe('email', email.toLowerCase(), password);
  if (key.isErr && key.error instanceof Error) {
    switch (key.error.message) {
      case 'AUTH_INVALID_KEY_ID':
        return buildClientErrorResponse(res, INCORRECT_EMAIL_OR_PASSWORD);
      case 'AUTH_INVALID_PASSWORD':
        return buildClientErrorResponse(res, INCORRECT_EMAIL_OR_PASSWORD);
      default:
        return buildUnknownErrorResponse(res);
    }
  }

  const session = await auth.createSession({
    userId: key.unwrap().userId,
    attributes: {},
  });
  const sessionCookie = auth.createSessionCookie(session);
  res.setHeader('Set-Cookie', sessionCookie.serialize());
  return res.sendStatus(302);
});

export default router;
