import { NextAuthOptions } from 'next-auth';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'yandex',
      name: 'Yandex',
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
        id: string;
        display_name?: string;
        real_name?: string;
        default_email?: string;
        default_avatar_id?: string;
      }) {
        return {
          id: String(profile.id),
          name: profile.display_name || profile.real_name || null,
          email: profile.default_email || null,
          image: profile.default_avatar_id
            ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
            : null,
        };
      },
    } as Parameters<typeof import('next-auth')['default']>[0]['providers'][0],
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'yandex' && user.id) {
        try {
          await prisma.user.upsert({
            where: { yandexId: user.id },
            update: {
              name: user.name,
              email: user.email,
              avatar: user.image,
            },
            create: {
              yandexId: user.id,
              name: user.name,
              email: user.email,
              avatar: user.image,
            },
          });
        } catch (error) {
          console.error('Error upserting user:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'yandex' && user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { yandexId: user.id },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.yandexId = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        (session.user as typeof session.user & { id: string }).id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
