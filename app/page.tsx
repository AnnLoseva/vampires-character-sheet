import CharacterSheet from '@/components/CharacterSheet'
import { SpeedInsights } from '@vercel/speed-insights/next';


export default function Home() {
  return(
    <>
  
  <CharacterSheet />
  <SpeedInsights />
  </> 
  )
}