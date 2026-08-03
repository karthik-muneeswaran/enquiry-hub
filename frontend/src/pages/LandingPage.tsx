import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Hero, Features, HowItWorks, PlatformStats, CTAFooter } from '../components/landing';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <Hero />
      <Features />
      <HowItWorks />
      <PlatformStats />
      <CTAFooter />
      <Footer />
    </div>
  );
}
