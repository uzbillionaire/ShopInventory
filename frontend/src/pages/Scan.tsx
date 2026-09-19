import Quagga, { type QuaggaJSResultObject } from '@ericblade/quagga2'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { CameraIcon } from '../components/Icons'
import { useI18n, type MessageKey } from '../i18n'
import { scanFeedback } from '../lib/feedback'

// Same alphabet as inventory/models.py: no 0/O or 1/I.
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/

type CameraState = 'idle' | 'starting' | 'live' | 'found'

export default function Scan() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const viewRef = useRef<HTMLDivElement>(null)
  const [camera, setCamera] = useState<CameraState>('idle')
  const [problem, setProblem] = useState<MessageKey | null>(null)
  const [manual, setManual] = useState('')
  const running = useRef(false)
  const starting = useRef(false)
  const unmounted = useRef(false)

  function stop() {
    if (running.current) {
      running.current = false
      Quagga.offDetected()
      void Quagga.stop()
    }
  }

  function start() {
    if (starting.current || running.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem(window.isSecureContext ? 'cameraFailed' : 'cameraInsecure')
      return
    }
    starting.current = true
    setProblem(null)
    setCamera('starting')
    const seen = new Map<string, number>()

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: viewRef.current ?? undefined,
          constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        },
        locator: { patchSize: 'medium', halfSample: true },
        decoder: { readers: ['code_128_reader'] },
        frequency: 10,
        locate: true,
      },
      (error: unknown) => {
        starting.current = false
        if (unmounted.current) {
          // Left the page while the camera was starting: release it straight away.
          if (!error) void Quagga.stop()
          return
        }
        if (error) {
          const denied = (error as { name?: string }).name === 'NotAllowedError' || /permission|denied/i.test(String(error))
          setProblem(denied ? 'cameraDenied' : 'cameraFailed')
          setCamera('idle')
          return
        }
        running.current = true
        setCamera('live')
        Quagga.onDetected((result: QuaggaJSResultObject) => {
          const code = (result.codeResult?.code ?? '').toUpperCase()
          if (!CODE_PATTERN.test(code)) return
          // Two matching reads, so one smudged frame can't open the wrong shoe.
          const count = (seen.get(code) ?? 0) + 1
          seen.set(code, count)
          if (count < 2) return
          setCamera('found')
          scanFeedback()
          stop()
          navigate(`/e/${code}`)
        })
        Quagga.start()
      },
    )
  }

  useEffect(() => {
    unmounted.current = false
    // Skip the extra tap when the camera was already allowed on this device.
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((permission) => { if (permission.state === 'granted') start() })
      .catch(() => {})
    return () => {
      unmounted.current = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openManual(event: FormEvent) {
    event.preventDefault()
    const code = manual.trim().toUpperCase()
    if (code) navigate(`/e/${encodeURIComponent(code)}`)
  }

  const status: Record<CameraState, MessageKey | null> = {
    idle: null, starting: 'cameraStarting', live: 'cameraAim', found: 'cameraFound',
  }

  return (
    <>
      <div className="page-head"><h1 className="page-title">{t('scanTitle')}</h1></div>

      <div className={`scanner${camera === 'found' ? ' found' : ''}`}>
        <div className="scanner-view" ref={viewRef} />
        {(camera === 'live' || camera === 'found') && <div className="scan-window" aria-hidden="true" />}
        {camera === 'idle' || camera === 'starting' ? (
          <div className="scanner-start">
            <p>{problem ? t(problem) : t('cameraIntro')}</p>
            <button type="button" className="button" onClick={start} disabled={camera === 'starting'}>
              <CameraIcon size={20} />
              {camera === 'starting' ? t('cameraStarting') : t('startCamera')}
            </button>
          </div>
        ) : (
          <p className="scanner-status" role="status">{status[camera] && t(status[camera]!)}</p>
        )}
      </div>

      <form onSubmit={openManual}>
        <label className="field-label" htmlFor="manual-code" style={{ display: 'block', marginBottom: 6 }}>{t('typeCode')}</label>
        <div className="manual-code">
          <input id="manual-code" className="input" value={manual} onChange={(e) => setManual(e.target.value)}
            placeholder={t('codeExample')} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go" />
          <button type="submit" className="button" disabled={!manual.trim()}>{t('open')}</button>
        </div>
      </form>
    </>
  )
}
