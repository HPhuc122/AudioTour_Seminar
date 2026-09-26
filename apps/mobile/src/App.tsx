import { useState } from 'react';
import BottomTabBar from './components/BottomTabBar';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import LocationList from './screens/LocationList';
import LocationDetail from './screens/LocationDetail';
import MapScreen from './screens/MapScreen';
import TourList from './screens/TourList';
import TourDetail from './screens/TourDetail';
import Packages from './screens/Packages';
import QRScanner from './screens/QRScanner';
import Search from './screens/Search';
import LanguageSheet from './screens/LanguageSheet';

export type Screen =
  | 'home'
  | 'locations'
  | 'location-detail'
  | 'map'
  | 'tours'
  | 'tour-detail'
  | 'packages'
  | 'search';

export default function App() {
  const [onboarded, setOnboarded] = useState(false);
  const [language, setLanguage] = useState('vi');
  const [tab, setTab] = useState<Screen>('home');
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [hasTicket, setHasTicket] = useState(false);
  const [ticketMinutes, setTicketMinutes] = useState(120);

  const tabScreens: Screen[] = ['home', 'map', 'tours', 'packages', 'search'];

  const handleTabChange = (s: Screen) => {
    setTab(s);
    setScreen(s);
    setSelectedLocation(null);
    setSelectedTour(null);
  };

  const handleLocationSelect = (id: string) => {
    setSelectedLocation(id);
    setScreen('location-detail');
  };

  const handleTourSelect = (id: string) => {
    setSelectedTour(id);
    setScreen('tour-detail');
  };

  const handleBack = () => {
    if (screen === 'location-detail' || screen === 'tour-detail') {
      setScreen(tab);
    } else if (screen === 'locations') {
      setScreen('home');
    }
  };

  const handleNav = (s: string) => {
    if (s === 'locations') {
      setScreen('locations');
    } else {
      handleTabChange(s as Screen);
    }
  };

  const handleActivateTicket = () => {
    setHasTicket(true);
    setTicketMinutes(120);
  };

  if (!onboarded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#d1fae5' }}>
        <div className="relative overflow-hidden rounded-3xl shadow-2xl" style={{ width: 390, height: 844 }}>
          <Onboarding onDone={(lang) => { setLanguage(lang); setOnboarded(true); }} />
        </div>
      </div>
    );
  }

  const isTabScreen = tabScreens.includes(screen);
  const activeTab = isTabScreen ? screen : tab;

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#d1fae5' }}>
      <div
        className="relative overflow-hidden rounded-3xl shadow-2xl flex flex-col"
        style={{ width: 390, height: 844, background: '#f7fdf9' }}
      >
        {/* Main screen area */}
        <div className="flex-1 overflow-hidden relative">
          {screen === 'home' && (
            <Home
              onLocationSelect={handleLocationSelect}
              onTourSelect={handleTourSelect}
              onNav={handleNav}
              language={language}
              onLangOpen={() => setShowLang(true)}
            />
          )}
          {screen === 'locations' && (
            <LocationList onSelect={handleLocationSelect} onBack={() => setScreen('home')} />
          )}
          {screen === 'location-detail' && selectedLocation && (
            <LocationDetail
              locationId={selectedLocation}
              hasTicket={hasTicket}
              ticketMinutes={ticketMinutes}
              language={language}
              onBack={handleBack}
              onMap={() => handleTabChange('map')}
              onPackages={() => handleTabChange('packages')}
            />
          )}
          {screen === 'map' && (
            <MapScreen onLocationSelect={handleLocationSelect} />
          )}
          {screen === 'tours' && (
            <TourList onSelect={handleTourSelect} onBack={() => handleTabChange('home')} />
          )}
          {screen === 'tour-detail' && selectedTour && (
            <TourDetail
              tourId={selectedTour}
              hasTicket={hasTicket}
              ticketMinutes={ticketMinutes}
              language={language}
              onBack={handleBack}
              onLocationSelect={handleLocationSelect}
              onPackages={() => handleTabChange('packages')}
            />
          )}
          {screen === 'packages' && (
            <Packages
              hasTicket={hasTicket}
              ticketMinutes={ticketMinutes}
              onBack={() => handleTabChange('home')}
              onActivate={handleActivateTicket}
            />
          )}
          {screen === 'search' && (
            <Search onLocationSelect={handleLocationSelect} onTourSelect={handleTourSelect} />
          )}
        </div>

        {/* Bottom tab */}
        <BottomTabBar active={activeTab} onChange={handleTabChange} onQR={() => setShowQR(true)} />

        {/* QR Scanner overlay */}
        {showQR && (
          <QRScanner
            onClose={() => setShowQR(false)}
            onSuccess={() => {
              handleActivateTicket();
              setShowQR(false);
            }}
          />
        )}

        {/* Language sheet */}
        {showLang && (
          <LanguageSheet
            current={language}
            onSelect={setLanguage}
            onClose={() => setShowLang(false)}
          />
        )}
      </div>
    </div>
  );
}
