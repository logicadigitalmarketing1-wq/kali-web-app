import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HexStrike Security Platform',
  description: 'Professional security assessment platform powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
