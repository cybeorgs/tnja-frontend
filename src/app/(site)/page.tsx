import HeroSection from "@/components/features/HeroSection";
import JudoJourneySection from "@/components/features/JudoJourneySection";
import EventsSection from "@/components/features/EventsSection";
import NewsMarquee from "@/components/features/NewsMarquee";
import PhilosophySection from "@/components/features/PhilosophySection";
import PhilosophyCarousel from "@/components/features/PhilosophyCarousel";
import TalentedPlayers from "@/components/features/TalentedPlayers";
import TalentedCoaches from "@/components/features/TalentedCoaches";
import VisionMission from "@/components/features/VisionMission";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-white">
      {/* Wrapper for Header and Hero with grid background */}
      <div className="relative z-0">
        <div
          className="absolute inset-0 -z-10 opacity-[0.05]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #f26522 1px, transparent 1px),
              linear-gradient(to bottom, #f26522 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}
        />
        <HeroSection />
        <JudoJourneySection />
        <EventsSection />
      </div>

      <div className="flex flex-col w-full">
        {/* Philosophy Carousel: md:1st, mobile:4th (directly above TalentedPlayers) */}
        <div className="order-4 md:order-1">
          <PhilosophyCarousel />
        </div>

        {/* Philosophy Numbered Cards: md:2nd, mobile:1st */}
        <div className="order-1 md:order-2">
          <PhilosophySection />
        </div>

        {/* VisionMission: md:3rd, mobile:2nd */}
        <div className="order-2 md:order-3">
          <VisionMission />
        </div>

        {/* TalentedCoaches: md:4th, mobile:3rd */}
        <div className="order-3 md:order-4">
          <TalentedCoaches />
        </div>

        {/* TalentedPlayers: md:5th, mobile:5th */}
        <div className="order-5 md:order-5">
          <TalentedPlayers />
        </div>
      </div>


      {/* Other sections can be added here */}
    </main>
  );
}
