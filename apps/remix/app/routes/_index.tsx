import { redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  // Signed-in agents land on the branded Foraker Sign home; everyone else signs in.
  if (session.isAuthenticated) {
    throw redirect('/home');
  }

  throw redirect('/signin');
}
