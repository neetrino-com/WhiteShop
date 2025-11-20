import { HeroCarousel } from '../components/HeroCarousel';
import { FeaturesSection } from '../components/FeaturesSection';
import { TopCategories } from '../components/TopCategories';
import { FeaturedProductsTabs } from '../components/FeaturedProductsTabs';

export default async function HomePage() {

  return (
    <div className="min-h-screen">
      {/* Hero Section - Full Width */}
      <section className="bg-white">
        <HeroCarousel />
      </section>

      {/* Top Categories */}
      <TopCategories />

      {/* Featured Products with Tabs */}
      <FeaturedProductsTabs />

      {/* Features Section */}
      <FeaturesSection />
    </div>
  );
}

