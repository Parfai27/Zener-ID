import { signIn } from '../signin'

export async function POST(request: Request) {
  return signIn(request, '/v1/auth/register', 'Could not create the account')
}
