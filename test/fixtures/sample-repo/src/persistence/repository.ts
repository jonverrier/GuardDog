import { getUser } from '../api/users';
import { queryDb } from './database';

export function fetchUserProfile(id: string): unknown {
   const user = getUser(id);
   return queryDb(`SELECT * FROM users WHERE id = '${id}'`, user);
}
