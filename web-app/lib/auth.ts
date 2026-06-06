import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'

async function upsertUser(provider: string, externalId: string, name?: string | null, email?: string | null, image?: string | null) {
  const where = provider === 'google' ? { googleId: externalId } : { yandexId: externalId }
  const data = provider === 'google'
    ? { googleId: externalId, name, email, avatar: image }
    : { yandexId: externalId, name, email, avatar: image }
  return prisma.user.upsert({ where, update: { name, email, avatar: image }, create: data })
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    {
      id: 'yandex',
      name: 'Яндекс',
      type: 'oauth',
      authorization: {
        url: 'https://oauth.yandex.ru/authorize',
        params: { scope: 'login:email login:info login:avatar' },
      },
      token: 'https://oauth.yandex.ru/token',
      userinfo: 'https://login.yandex.ru/info?format=json',
      clientId: process.env.YANDEX_CLIENT_ID,
      clientSecret: process.env.YANDEX_CLIENT_SECRET,
      profile(profile: {
        id: string
        display_name?: string
        real_name?: string
        login?: string
        default_email?: string
        default_avatar_id?: string
      }) {
        return {
          id: String(profile.id),
          name: profile.display_name || profile.real_name || profile.login || null,
          email: profile.default_email || null,
          image: profile.default_avatar_id
            ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
            : null,
        }
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account?.provider || !user?.id) return false
      try {
        await upsertUser(account.provider, user.id, user.name, user.email, user.image)
        return true
      } catch (error) {
        console.error('signIn error:', error)
        return false
      }
    },
    async jwt({ token, user, account }) {
      if (account?.provider && user?.id) {
        token.provider = account.provider
        try {
          const where = account.provider === 'google' ? { googleId: user.id } : { yandexId: user.id }
          const dbUser = await prisma.user.findUnique({ where })
          if (dbUser) token.dbUserId = dbUser.id
        } catch (e) {
          console.error('jwt error:', e)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.dbUserId && session.user) {
        const u = session.user as typeof session.user & { id: string; provider: string }
        u.id = token.dbUserId as string
        u.provider = (token.provider as string) ?? 'yandex'
      }
      return session
    },
  },
}

export function getUserId(session: { user?: { id?: string } } | null): string | null {
  return (session?.user as { id?: string } | undefined)?.id ?? null
}
