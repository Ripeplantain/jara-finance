/**
 * Every Better Auth endpoint — sign up, sign in, sign out, session — is served
 * from this one catch-all. The mount path is `/api/auth/**`, which is what
 * `baseURL` and the browser client both assume.
 */
export default defineEventHandler(event => useAuth().handler(toWebRequest(event)))
