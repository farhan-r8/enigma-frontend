import './globals.css';
import { AudioProvider } from '../components/audio/AudioProvider';

export const metadata = {
  title: 'Modern Intelligence Dashboard',
  description: 'Web game typing real-time dan puzzle intelijen dua fase: dekripsi token dan end challenge berbasis laporan penuh.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AudioProvider>{children}</AudioProvider>
      </body>
    </html>
  );
}
