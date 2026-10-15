'use client'

import type { AudioInputs } from '@/hooks/use-audio-inputs'

// Picks the capture device (built-in mic, USB interface from the mixing console…).
// Locked while broadcasting — stop, switch, start again.
export function AudioInputSelect({ inputs, disabled = false }: { inputs: AudioInputs; disabled?: boolean }) {
  const { devices, deviceId, setDeviceId, detect, hasLabels } = inputs

  return (
    <div>
      <label
        htmlFor="audio-input-select"
        className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#424752]"
      >
        Fonte de áudio
      </label>
      <div className="flex items-center gap-2">
        <div className="flex w-56 items-center gap-2 rounded-xl border border-[#c2c6d4]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#191c21] transition-colors focus-within:border-[#00488d] hover:border-[#00488d]">
          <span className="material-symbols-outlined text-base text-[#00488d]">settings_input_component</span>
          <select
            id="audio-input-select"
            value={deviceId ?? ''}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={disabled}
            className="min-w-0 flex-1 truncate bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Padrão do sistema</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Entrada ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
        {!hasLabels && !disabled && (
          <button
            type="button"
            onClick={detect}
            className="rounded-xl border border-[#c2c6d4]/50 bg-white px-3 py-2.5 text-xs font-semibold text-[#00488d] hover:border-[#00488d]"
          >
            Detectar dispositivos
          </button>
        )}
      </div>
    </div>
  )
}
