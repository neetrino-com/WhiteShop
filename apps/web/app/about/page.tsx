import Image from 'next/image';
import { TeamCarousel } from '../../components/TeamCarousel';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

/**
 * Страница About Us
 * Содержит две основные секции:
 * 1. About our online store - информация о магазине с изображением
 * 2. Our Team - карусель с членами команды
 */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Секция: About our online store */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Изображение слева */}
            <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="https://images.pexels.com/photos/3184357/pexels-photo-3184357.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
                alt="Our team working together"
                fill
                className="object-cover"
                priority
                unoptimized
              />
            </div>

            {/* Текст справа */}
            <div className="space-y-6">
              {/* Подзаголовок */}
              <p className="text-sm md:text-base font-semibold uppercase tracking-wider text-[#7CB342]">
                SEEMINGLY ELEGANT DESIGN
              </p>

              {/* Заголовок */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                About our online store
              </h1>

              {/* Текст */}
              <div className="space-y-4 text-gray-600 text-base md:text-lg leading-relaxed">
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud 
                  exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p>
                  Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu 
                  fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in 
                  culpa qui officia deserunt mollit anim id est laborum.
                </p>
                <p>
                  Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque 
                  laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi 
                  architecto beatae vitae dicta sunt explicabo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Секция: Our Team */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            {/* Подзаголовок */}
            <p className="text-sm md:text-base font-semibold uppercase tracking-wider text-[#7CB342] mb-4">
              WORDS ABOUT US
            </p>

            {/* Заголовок */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
              Our Team
            </h2>

            {/* Описание */}
            <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto">
              Curvallis ulemperatuurimatikamobor.sal.
            </p>
          </div>

          {/* Карусель команды */}
          <div className="max-w-6xl mx-auto">
            <TeamCarousel />
          </div>
        </div>
      </section>
    </div>
  );
}
