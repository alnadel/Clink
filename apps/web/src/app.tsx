import type { JSX } from 'preact';
import { LocationProvider, Route, Router } from 'preact-iso';
import { ToastHost } from './ui/components/Toast';
import { SoundChoice } from './ui/SoundChoice';
import { HomeScreen } from './ui/screens/HomeScreen';
import { LinkScreen } from './ui/screens/LinkScreen';
import { MapScreen } from './ui/screens/MapScreen';
import { NotFoundScreen } from './ui/screens/NotFoundScreen';
import { PlayScreen } from './ui/screens/PlayScreen';
import { PrivacyScreen } from './ui/screens/PrivacyScreen';
import { RestoreScreen } from './ui/screens/RestoreScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { SongbookScreen } from './ui/screens/SongbookScreen';
import { type Services, ServicesContext } from './ui/services';

/** Providers and routes (docs/architecture/05 §2.1). */
export function App({ services }: { services: Services }): JSX.Element {
  return (
    <ServicesContext.Provider value={services}>
      <LocationProvider>
        <Router>
          <Route path="/" component={HomeScreen} />
          <Route path="/map" component={MapScreen} />
          <Route path="/play/:levelId" component={PlayScreen} />
          <Route path="/daily" component={() => <PlayScreen kind="daily" />} />
          <Route path="/d/:n" component={LinkScreen} />
          <Route path="/songbook" component={SongbookScreen} />
          <Route path="/settings" component={SettingsScreen} />
          <Route path="/restore" component={RestoreScreen} />
          <Route path="/privacy" component={PrivacyScreen} />
          <Route default component={NotFoundScreen} />
        </Router>
        <SoundChoice />
        <ToastHost />
      </LocationProvider>
    </ServicesContext.Provider>
  );
}
