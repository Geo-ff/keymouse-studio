/* =========================================================================
   useService — React hook 订阅 service 状态
   组件通过此 hook 获取 service 实例和实时状态
   ========================================================================= */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ServiceState, AppSettings } from '../types';
import { getService } from '../services/AutomationService';

export function useService() {
  const service = getService();
  const [state, setState] = useState<ServiceState>(service.state);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = service.onStateChange((newState) => {
      if (mountedRef.current) {
        setState(newState);
      }
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [service]);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    service.updateSettings(settings);
  }, [service]);

  return { service, state, updateSettings };
}
