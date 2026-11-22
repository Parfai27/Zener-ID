import { signIn } from '../signin'

export async function POST(request: Request) {
  return signIn(request, '/v1/auth/login', 'Email or password is wrong')
}
