# GreenViva

A Next.js application that helps track your Viva Wallet transfers by integrating with Gmail API.

## Features

- Gmail API integration to fetch Viva Wallet transfer emails
- Real-time transfer tracking
- Daily, monthly, and historical views
- Progress tracking towards financial goals
- Secure authentication with Google OAuth

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- A Google Cloud Project with Gmail API enabled
- A Viva Wallet account

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/klepi21/greenviva.git
   cd greenviva
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

The application is configured for deployment on Vercel. Follow these steps:

1. Push your code to GitHub
2. Import your repository in Vercel
3. Configure environment variables in Vercel
4. Deploy!

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Gmail API](https://developers.google.com/gmail/api) - Email integration
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
