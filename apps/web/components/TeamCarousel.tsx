'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

/**
 * Интерфейс для члена команды
 */
interface TeamMember {
  id: string;
  name: string;
  position: string;
  image: string;
  social: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
}

/**
 * Данные команды (4 существующих + 1 новый)
 */
const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Mark Jance',
    position: 'CEO/FOUNDER',
    image: 'https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2',
    social: {
      facebook: '#',
      twitter: '#',
      linkedin: '#',
      instagram: '#',
    },
  },
  {
    id: '2',
    name: 'Aviana Plummer',
    position: 'CEO/FOUNDER',
    image: 'https://images.pexels.com/photos/3184405/pexels-photo-3184405.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2',
    social: {
      facebook: '#',
      twitter: '#',
      linkedin: '#',
      instagram: '#',
    },
  },
  {
    id: '3',
    name: 'Braydon Wilkerson',
    position: 'CEO/FOUNDER',
    image: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2',
    social: {
      facebook: '#',
      twitter: '#',
      linkedin: '#',
      instagram: '#',
    },
  },
  {
    id: '4',
    name: 'Kristin Watson',
    position: 'CEO/FOUNDER',
    image: 'https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2',
    social: {
      facebook: '#',
      twitter: '#',
      linkedin: '#',
      instagram: '#',
    },
  },
  {
    id: '5',
    name: 'Alex Morgan',
    position: 'CTO/CO-FOUNDER',
    image: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2',
    social: {
      facebook: '#',
      twitter: '#',
      linkedin: '#',
      instagram: '#',
    },
  },
];

/**
 * Компонент карусели команды
 * Отображает карточки членов команды с возможностью прокрутки
 */
export function TeamCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState(4);

  // Определение количества видимых карточек в зависимости от размера экрана
  useEffect(() => {
    const updateVisibleCards = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleCards(1); // mobile
      } else if (width < 1024) {
        setVisibleCards(2); // tablet
      } else if (width < 1280) {
        setVisibleCards(3); // desktop
      } else {
        setVisibleCards(4); // large desktop
      }
    };

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  // Корректировка currentIndex при изменении visibleCards
  useEffect(() => {
    const maxIndex = Math.max(0, teamMembers.length - visibleCards);
    setCurrentIndex((prevIndex) => {
      if (prevIndex > maxIndex) {
        console.info('[TeamCarousel] Adjusting index due to visibleCards change:', { 
          oldIndex: prevIndex, 
          newIndex: maxIndex 
        });
        return maxIndex;
      }
      return prevIndex;
    });
  }, [visibleCards]);

  // Визуальное логирование для отладки
  useEffect(() => {
    console.info('[TeamCarousel] Current index changed:', currentIndex);
    console.info('[TeamCarousel] Visible cards:', visibleCards);
  }, [currentIndex, visibleCards]);

  const maxIndex = Math.max(0, teamMembers.length - visibleCards);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => {
      const newIndex = prevIndex === 0 ? maxIndex : prevIndex - 1;
      console.info('[TeamCarousel] Navigate previous:', { from: prevIndex, to: newIndex });
      return newIndex;
    });
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => {
      const newIndex = prevIndex >= maxIndex ? 0 : prevIndex + 1;
      console.info('[TeamCarousel] Navigate next:', { from: prevIndex, to: newIndex });
      return newIndex;
    });
  };

  const goToSlide = (index: number) => {
    console.info('[TeamCarousel] Go to slide:', index);
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full">
      {/* Карусель контейнер */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / visibleCards)}%)`,
          }}
        >
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex-shrink-0 px-3"
              style={{ width: `${100 / visibleCards}%` }}
            >
              <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
                {/* Изображение */}
                <div className="relative w-full aspect-square overflow-hidden">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    unoptimized
                  />
                </div>

                {/* Информация */}
                <div className="p-6 text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{member.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{member.position}</p>

                  {/* Социальные сети */}
                  <div className="flex justify-center gap-3">
                    {member.social.facebook && (
                      <a
                        href={member.social.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
                        aria-label={`${member.name} Facebook`}
                      >
                        <Facebook size={18} />
                      </a>
                    )}
                    {member.social.twitter && (
                      <a
                        href={member.social.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white hover:bg-sky-600 transition-colors"
                        aria-label={`${member.name} Twitter`}
                      >
                        <Twitter size={18} />
                      </a>
                    )}
                    {member.social.linkedin && (
                      <a
                        href={member.social.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white hover:bg-blue-800 transition-colors"
                        aria-label={`${member.name} LinkedIn`}
                      >
                        <Linkedin size={18} />
                      </a>
                    )}
                    {member.social.instagram && (
                      <a
                        href={member.social.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white hover:from-purple-600 hover:to-pink-600 transition-colors"
                        aria-label={`${member.name} Instagram`}
                      >
                        <Instagram size={18} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Навигационные стрелки */}
      {teamMembers.length > visibleCards && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-8 md:-translate-x-12 bg-transparent hover:bg-transparent text-gray-900 p-3 transition-all z-10 hover:scale-110"
            aria-label="Previous team member"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-8 md:translate-x-12 bg-transparent hover:bg-transparent text-gray-900 p-3 transition-all z-10 hover:scale-110"
            aria-label="Next team member"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}

      {/* Индикаторы точек */}
      {teamMembers.length > visibleCards && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-gray-900 w-8'
                  : 'bg-gray-300 hover:bg-gray-400 w-2'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

