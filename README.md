This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Wallet Duplicate Regression Checklist

`user_cards` is expected to be unique on `(user_id, card_id)` and wallet writes should be idempotent.

Manual verification:

1. Add a card once in onboarding wallet builder and confirm it appears in wallet.
2. Try adding the same card again and confirm UI shows `In wallet` / no-op with no error.
3. Add the same card from two tabs quickly and confirm only one row is stored.
4. Remove the card (hard delete) and confirm adding it again succeeds.

Supabase SQL editor verification query:

```sql
select user_id, card_id, count(*) as row_count
from public.user_cards
group by user_id, card_id
having count(*) > 1;
```
