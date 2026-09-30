import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useStore } from '../hooks/useStore';
import { useServices } from '../services';

/**
 * /d/:n: a shared link. It opens today's puzzle (D8); a first-time player plays the short tutorial first
 * (FR-23, D17). Waits for the first-launch sound choice before doing anything.
 */
export function LinkScreen({ n = '0' }: { n?: string }): JSX.Element | null {
  const { analytics, content, save, profile } = useServices();
  const location = useLocation();
  const current = useStore(profile);
  const tracked = useRef(false);
  const newDevice = useRef(save.wasProfileCreated());

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    analytics.track('link_open', { puzzle_no: Number(n) || 0, new_device: newDevice.current });
  }, [analytics, n]);

  useEffect(() => {
    if (!current.soundChoiceMade) return;
    const manifest = content.manifest();
    const tutorial = manifest.guides.linkTutorial.filter((id) => manifest.levelOrder.includes(id));
    const first = tutorial[0];
    if (first && !current.seenGuides.includes('linkTutorial'))
      location.route(`/play/${first}?tutorial=1`, true);
    else location.route('/daily', true);
  }, [current.soundChoiceMade, current.seenGuides, content, location]);

  return null;
}
