import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import AboutSection from '@/components/AboutSection'
import ProjectsGrid from '@/components/ProjectsGrid'
import ContactSection from '@/components/ContactSection'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ProjectsGrid />
      <ContactSection />
      <Footer />
    </main>
  )
}
