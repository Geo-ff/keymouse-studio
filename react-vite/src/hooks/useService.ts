import { useMemo } from 'react';
import { useAutomation } from '../providers/AutomationProvider';

export function useService() {
  const context = useAutomation();
  const { service, ...resources } = context;

  return useMemo(() => ({
    ...resources,
    mode: service.mode,
    getState: () => service.getState(),
    getMousePosition: () => service.getMousePosition(),
    startClicker: (...args: Parameters<typeof service.startClicker>) => service.startClicker(...args),
    pauseClicker: () => service.pauseClicker(),
    resumeClicker: () => service.resumeClicker(),
    stopClicker: () => service.stopClicker(),
    startTimedClick: (...args: Parameters<typeof service.startTimedClick>) => service.startTimedClick(...args),
    stopTimedClick: () => service.stopTimedClick(),
    startRecording: (...args: Parameters<typeof service.startRecording>) => service.startRecording(...args),
    pauseRecording: () => service.pauseRecording(),
    resumeRecording: () => service.resumeRecording(),
    stopRecording: () => service.stopRecording(),
    getRecordingResult: (...args: Parameters<typeof service.getRecordingResult>) => service.getRecordingResult(...args),
    playback: (...args: Parameters<typeof service.playback>) => service.playback(...args),
    pausePlayback: () => service.pausePlayback(),
    resumePlayback: () => service.resumePlayback(),
    stopPlayback: () => service.stopPlayback(),
    emergencyStop: () => service.emergencyStop(),
    validateScript: (...args: Parameters<typeof service.validateScript>) => service.validateScript(...args),
    saveScript: (...args: Parameters<typeof service.saveScript>) => service.saveScript(...args),
    loadScript: (...args: Parameters<typeof service.loadScript>) => service.loadScript(...args),
    listScripts: () => service.listScripts(),
    duplicateScript: (...args: Parameters<typeof service.duplicateScript>) => service.duplicateScript(...args),
    deleteScript: (...args: Parameters<typeof service.deleteScript>) => service.deleteScript(...args),
    getSettings: () => service.getSettings(),
    getCapabilities: () => service.getCapabilities(),
    getHotkeyStatus: () => service.getHotkeyStatus(),
  }), [resources, service]);
}
