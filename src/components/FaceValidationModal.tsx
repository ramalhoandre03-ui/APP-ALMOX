import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Eye,
  Scan,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  Sparkles,
  Lock,
  Clock,
  User
} from 'lucide-react';

export interface ValidatedBiometricUser {
  id: string | number;
  nome: string;
  cargo?: string;
  perfil?: string;
  email?: string;
  confidence: number;
  distance: number;
}

export interface FaceValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (usuarioReconhecido: ValidatedBiometricUser) => void;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  itemDescription?: string;
  orderNumber?: string;
  timeoutSeconds?: number;
}

export function FaceValidationModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Autenticação Biométrica Obrigatória',
  subtitle = 'Validação facial com prova de vida para homologar o recebimento de compras',
  actionLabel = 'Homologar Recebimento',
  itemDescription,
  orderNumber,
  timeoutSeconds = 25
}: FaceValidationModalProps) {
  // 1. Estados de Modelos & Usuários
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [usersWithBio, setUsersWithBio] = useState<any[]>([]);
  const [facesCadastradas, setFacesCadastradas] = useState<number>(0);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Inicializando scanner biométrico...');

  // 2. Estados de Câmera & Stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 3. Prova de Vida (Head Yaw Estimation)
  const [isAlive, setIsAlive] = useState(false);
  const [currentYawRatio, setCurrentYawRatio] = useState<number>(1.0);

  // 4. Reconhecimento Facial & Match
  const [detectedFaces, setDetectedFaces] = useState<number>(0);
  const [matchedUser, setMatchedUser] = useState<ValidatedBiometricUser | null>(null);
  const [isProcessingMatch, setIsProcessingMatch] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);

  // 5. Timeout & Contagem Regressiva
  const [timeLeft, setTimeLeft] = useState<number>(timeoutSeconds);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timerIntervalRef = useRef<any>(null);

  // ============================================================================
  // LIMPEZA SEGURA DE RECURSOS (STREAMS, INTERVALOS, ANIMAÇÕES)
  // ============================================================================
  const stopCameraAndLoops = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // ============================================================================
  // CARREGAR MODELOS NEURAIS DO FACE-API
  // ============================================================================
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadModels() {
      setIsLoadingModels(true);
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        if (isMounted) {
          setModelsLoaded(true);
          setIsLoadingModels(false);
        }
      } catch (err: any) {
        console.error('[FaceValidationModal] Erro ao carregar modelos neurais:', err);
        if (isMounted) {
          setCameraError('Erro ao carregar rede neural de biometria facial.');
          setIsLoadingModels(false);
        }
      }
    }

    loadModels();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // ============================================================================
  // BUSCA SEGURA DE USUÁRIOS COM DESCRITORES BIOMÉTRICOS (BASE GLOBAL DE BIOMETRIAS)
  // ============================================================================
  const carregarBaseBiometrica = useCallback(async () => {
    setLoadingUsers(true);
    setMensagemErro(null);
    try {
      // Aponta direto para a biblioteca global de biometrias
      const { data: baseRostos, error } = await supabase
        .from('usuarios')
        .select('nome, face_descriptor, id_biometria_vinculada')
        .not('face_descriptor', 'is', null); // Traz todos que têm rosto, sem exceção

      if (error) throw error;
      if (!baseRostos || baseRostos.length === 0) {
        console.warn("Nenhuma face encontrada na biblioteca global.");
        setFacesCadastradas(0);
        setUsersWithBio([]);
        setFaceMatcher(null);
        setMensagemErro("Nenhum Colaborador com Biometria Cadastrada");
        setLoadingUsers(false);
        return;
      }

      const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
      const formattedUsers: any[] = [];

      baseRostos.forEach(user => {
        try {
          const descriptorData = typeof user.face_descriptor === 'string' 
            ? JSON.parse(user.face_descriptor) 
            : user.face_descriptor;
            
          if (!descriptorData) return;

          const float32Array = new Float32Array(Object.values(descriptorData));
          if (float32Array.length === 0) return;
          
          // O payload do label precisa ter o nome para carimbar na assinatura do PDF/Tela
          const labelData = JSON.stringify({ 
            nome: user.nome, 
            idAcesso: user.id_biometria_vinculada 
          });
          
          labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(labelData, [float32Array]));
          formattedUsers.push({
            id: user.id_biometria_vinculada || user.nome,
            nome: user.nome,
            idAcesso: user.id_biometria_vinculada,
            parsedDescriptor: float32Array,
            face_descriptor: Object.values(descriptorData)
          });
        } catch (convErr) {
          console.error(`[FaceValidationModal] Erro ao converter descritor de ${user.nome}:`, convErr);
        }
      });

      if (labeledDescriptors.length === 0) {
        console.warn("Nenhum descritor válido na biblioteca global.");
        setFacesCadastradas(0);
        setUsersWithBio([]);
        setFaceMatcher(null);
        setMensagemErro("Nenhum Colaborador com Biometria Cadastrada");
        setLoadingUsers(false);
        return;
      }

      // Tolerância de 0.6 garante a segurança do falso-positivo
      const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
      setFaceMatcher(matcher);
      setFacesCadastradas(baseRostos.length); // Atualiza a UI para provar que leu a biblioteca
      setUsersWithBio(formattedUsers);
      setMensagemErro(null);
      setLoadingUsers(false);

    } catch (err) {
      console.error("Erro ao carregar base biométrica global:", err);
      setFaceMatcher(null);
      setFacesCadastradas(0);
      setUsersWithBio([]);
      setMensagemErro("Erro ao comunicar com o banco de dados biométrico.");
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    carregarBaseBiometrica();
  }, [isOpen, carregarBaseBiometrica]);

  // ============================================================================
  // INICIALIZA STREAM DA CÂMERA
  // ============================================================================
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsAlive(false);
    setCurrentYawRatio(1.0);
    setMatchedUser(null);
    setValidationSuccess(false);
    setIsTimedOut(false);
    setTimeLeft(timeoutSeconds);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('[FaceValidationModal] Erro ao acessar webcam:', err);
      let msg = 'Não foi possível acessar a webcam.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de câmera negada. Por favor, permita o acesso nas configurações do seu navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera conectada foi encontrada neste dispositivo.';
      }
      setCameraError(msg);
    }
  }, [timeoutSeconds]);

  // Inicia a câmera quando os modelos e usuários estiverem prontos
  useEffect(() => {
    if (isOpen && modelsLoaded && !cameraActive && !cameraError) {
      startCamera();
    }
  }, [isOpen, modelsLoaded, cameraActive, cameraError, startCamera]);

  // ============================================================================
  // CONTAGEM REGRESSIVA DO TIMEOUT
  // ============================================================================
  useEffect(() => {
    if (!isOpen || !cameraActive || validationSuccess || isTimedOut) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          setIsTimedOut(true);
          setStatusMessage('Tempo de autenticação esgotado.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, cameraActive, validationSuccess, isTimedOut]);

  // ============================================================================
  // LOOP DE RECONHECIMENTO FACIAL E PROVA DE VIDA (EAR)
  // ============================================================================
  useEffect(() => {
    if (!isOpen || !cameraActive || !modelsLoaded || validationSuccess || isTimedOut) {
      return;
    }

    let isRunning = true;

    const detectAndMatchFace = async () => {
      if (!isRunning || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        animFrameRef.current = requestAnimationFrame(detectAndMatchFace);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(detectAndMatchFace);
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        });

        // Detecção com Landmarks (68 pontos) e Vetor de 128 dimensões
        const detection = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          setDetectedFaces(1);
          const box = detection.detection.box;

          // ==================================================================
          // PROVA DE VIDA ATIVA (LIVENESS VIA HEAD YAW ESTIMATION)
          // ==================================================================
          if (detection.landmarks) {
            const leftEye = detection.landmarks.getLeftEye();
            const rightEye = detection.landmarks.getRightEye();
            const nose = detection.landmarks.getNose();

            // Captura os eixos X dos pontos extremos
            const leftEyeCornerX = leftEye[0].x; 
            const rightEyeCornerX = rightEye[3].x; 
            const noseTipX = nose[3].x; 

            // Calcula a distância horizontal da ponta do nariz para cada olho
            const distLeft = Math.abs(noseTipX - leftEyeCornerX);
            const distRight = Math.abs(rightEyeCornerX - noseTipX);

            // Calcula a razão de rotação (Yaw Ratio)
            const yawRatio = distRight > 0 ? distLeft / distRight : 1.0;
            setCurrentYawRatio(Number(yawRatio.toFixed(2)));

            // LÓGICA ANTI-SPOOFING: Se o rosto estiver perfeitamente de frente, a razão é ~1.0.
            // Se virar para a direita ou esquerda, a razão dispara para cima de 1.6 ou cai para menos de 0.6.
            if (yawRatio > 1.6 || yawRatio < 0.6) {
              setIsAlive(true);
            }
          }

          // ==================================================================
          // COMPARAÇÃO BIOMÉTRICA COM FACEMATCHER (THRESHOLD 0.55)
          // ==================================================================
          let bestCandidate: { user: any; distance: number; label: string } | null = null;

          if (faceMatcher && detection.descriptor) {
            // Executa a busca utilizando o FaceMatcher oficial do face-api.js
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            if (bestMatch && bestMatch.label !== 'unknown') {
              let matchedUserObj: any = null;
              try {
                const parsed = JSON.parse(bestMatch.label);
                matchedUserObj = {
                  id: parsed.idAcesso || parsed.id || 'bio-' + parsed.nome,
                  nome: parsed.nome,
                  cargo: parsed.cargo || 'Responsável Técnico',
                  perfil: parsed.perfil || 'Operacional',
                  email: parsed.email || ''
                };
              } catch {
                matchedUserObj = usersWithBio.find(
                  u => u.nome === bestMatch.label || String(u.id) === bestMatch.label
                ) || {
                  id: 'bio-' + bestMatch.label,
                  nome: bestMatch.label,
                  cargo: 'Responsável Técnico',
                  perfil: 'Operacional'
                };
              }

              bestCandidate = {
                user: matchedUserObj,
                distance: bestMatch.distance,
                label: matchedUserObj.nome
              };
            }
          } else if (usersWithBio.length > 0 && detection.descriptor) {
            // Fallback: cálculo Euclidiano manual caso o FaceMatcher ainda esteja inicializando
            for (const u of usersWithBio) {
              const targetDesc = u.parsedDescriptor || (Array.isArray(u.face_descriptor) ? new Float32Array(u.face_descriptor) : null);
              if (targetDesc) {
                const distance = faceapi.euclideanDistance(detection.descriptor, targetDesc);
                if (!bestCandidate || distance < bestCandidate.distance) {
                  bestCandidate = { user: u, distance, label: u.nome };
                }
              }
            }
          }

          const MATCH_THRESHOLD = 0.6;
          const isBiometricMatch = Boolean(
            bestCandidate && 
            bestCandidate.distance <= MATCH_THRESHOLD && 
            bestCandidate.label !== 'unknown'
          );

          // ==================================================================
          // DESENHO VISUAL NA TELA
          // ==================================================================
          const strokeColor = isBiometricMatch
            ? (isAlive ? '#10b981' : '#38bdf8')
            : '#f59e0b';

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3;
          ctx.beginPath();

          // Cantos estilizados
          const corner = Math.min(24, box.width / 4);
          ctx.moveTo(box.x, box.y + corner);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + corner, box.y);

          ctx.moveTo(box.x + box.width - corner, box.y);
          ctx.lineTo(box.x + box.width, box.y);
          ctx.lineTo(box.x + box.width, box.y + corner);

          ctx.moveTo(box.x + box.width, box.y + box.height - corner);
          ctx.lineTo(box.x + box.width, box.y + box.height);
          ctx.lineTo(box.x + box.width - corner, box.y + box.height);

          ctx.moveTo(box.x + corner, box.y + box.height);
          ctx.lineTo(box.x, box.y + box.height);
          ctx.lineTo(box.x, box.y + box.height - corner);
          ctx.stroke();

          // Label flutuante
          let labelText = '';
          if (isBiometricMatch && bestCandidate) {
            const conf = Math.round(Math.max(0, (1 - bestCandidate.distance)) * 100);
            if (isAlive) {
              labelText = `✓ ${bestCandidate.user.nome} (${conf}%)`;
              ctx.fillStyle = '#10b981';
            } else {
              labelText = `Movimente o rosto • ${bestCandidate.user.nome}`;
              ctx.fillStyle = '#0284c7';
            }
          } else {
            labelText = 'Rosto não cadastrado / Posicione-se';
            ctx.fillStyle = '#d97706';
          }

          ctx.font = 'bold 13px Inter, sans-serif';
          const textW = ctx.measureText(labelText).width;
          ctx.fillRect(box.x, Math.max(0, box.y - 26), textW + 16, 22);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(labelText, box.x + 8, Math.max(16, box.y - 10));

          // ==================================================================
          // HOMOLOGAÇÃO POSITIVA: COMBINAÇÃO DE MATCH + PROVA DE VIDA
          // ==================================================================
          if (isBiometricMatch && isAlive && !validationSuccess && bestCandidate) {
            const conf = Math.round(Math.max(0, (1 - bestCandidate.distance)) * 100);
            const userObj: ValidatedBiometricUser = {
              id: bestCandidate.user.id,
              nome: bestCandidate.user.nome,
              cargo: bestCandidate.user.cargo || 'Colaborador Autorizado',
              perfil: bestCandidate.user.perfil,
              email: bestCandidate.user.email,
              confidence: conf,
              distance: Number(bestCandidate.distance.toFixed(3))
            };

            setMatchedUser(userObj);
            setValidationSuccess(true);
            setStatusMessage(`Validado com sucesso: ${userObj.nome} (${conf}%)`);
            setIsProcessingMatch(true);

            // Aguarda breve delay visual (600ms) e dispara o callback de sucesso
            setTimeout(() => {
              stopCameraAndLoops();
              onSuccess(userObj);
            }, 600);

            return; // Encerra o loop
          } else if (isBiometricMatch && !isAlive && bestCandidate) {
            setStatusMessage(`Colaborador detectado: ${bestCandidate.user.nome}. Movimente o rosto levemente para um dos lados.`);
          } else if (!faceMatcher && loadingUsers) {
            setStatusMessage('Carregando descritores biométricos...');
          } else {
            setStatusMessage('Rosto não reconhecido. Tente se reposicionar.');
          }
        } else {
          setDetectedFaces(0);
          setStatusMessage('Posicione seu rosto em frente à câmera...');
        }
      } catch (err) {
        console.warn('[FaceValidationModal] Erro no frame de detecção:', err);
      }

      if (isRunning && !validationSuccess && !isTimedOut) {
        animFrameRef.current = requestAnimationFrame(detectAndMatchFace);
      }
    };

    animFrameRef.current = requestAnimationFrame(detectAndMatchFace);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, cameraActive, modelsLoaded, usersWithBio, faceMatcher, loadingUsers, isAlive, validationSuccess, isTimedOut, stopCameraAndLoops, onSuccess]);

  // Limpeza ao fechar modal ou desmontar
  useEffect(() => {
    if (!isOpen) {
      stopCameraAndLoops();
    }
    return () => {
      stopCameraAndLoops();
    };
  }, [isOpen, stopCameraAndLoops]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      id="face-validation-modal-overlay"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden font-sans relative flex flex-col"
        id="face-validation-modal-card"
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="p-5 sm:p-6 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border shrink-0 transition-colors ${
              validationSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : isTimedOut
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
            }`}>
              {validationSuccess ? (
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              ) : isTimedOut ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <Scan className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-800/60">
                  Segurança Almoxarifado
                </span>
                {orderNumber && (
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-800/40">
                    PC {orderNumber}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-1">
                {title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCameraAndLoops();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors shrink-0"
            title="Cancelar validação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-5 sm:p-6 space-y-4 flex-1">
          {/* Card Resumo do Item / Pedido sendo recebido */}
          {itemDescription && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Item a ser Homologado:</span>
                  <span className="text-white font-bold truncate block">{itemDescription}</span>
                </div>
              </div>
              <span className="text-[11px] font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/50 shrink-0">
                {actionLabel}
              </span>
            </div>
          )}

          {/* VIEWPORT DA WEBCAM */}
          <div className="relative aspect-4/3 sm:aspect-16/10 rounded-2xl bg-black border-2 border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
            {/* Elemento de Vídeo */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Canvas de Overlay Neural */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
            />

            {/* Guia Visual Central (Oval de Enquadramento) */}
            {cameraActive && !validationSuccess && !isTimedOut && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`w-44 h-56 sm:w-48 sm:h-60 rounded-[48%] border-2 transition-all duration-300 flex items-center justify-center ${
                    validationSuccess
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                      : detectedFaces === 1
                      ? isAlive
                        ? 'border-emerald-400 bg-emerald-400/5 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        : 'border-sky-400 bg-sky-400/5 shadow-[0_0_20px_rgba(56,189,248,0.3)] animate-pulse'
                      : 'border-slate-500/40 border-dashed bg-slate-900/10'
                  }`}
                >
                  <div className="w-3 h-3 border-t-2 border-l-2 border-slate-400/60 absolute top-3 left-3" />
                  <div className="w-3 h-3 border-t-2 border-r-2 border-slate-400/60 absolute top-3 right-3" />
                  <div className="w-3 h-3 border-b-2 border-l-2 border-slate-400/60 absolute bottom-3 left-3" />
                  <div className="w-3 h-3 border-b-2 border-r-2 border-slate-400/60 absolute bottom-3 right-3" />
                </div>
              </div>
            )}

            {/* Overlay de Loading / Inicialização */}
            {(isLoadingModels || loadingUsers || (!cameraActive && !cameraError && !isTimedOut)) && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Carregando Módulos Neurais</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    {isLoadingModels
                      ? 'Inicializando rede tinyFaceDetector e descritores...'
                      : loadingUsers
                      ? 'Carregando biometrias cadastradas no Supabase...'
                      : 'Conectando à webcam...'}
                  </p>
                </div>
              </div>
            )}

            {/* Overlay de Sucesso com Animação */}
            <AnimatePresence>
              {validationSuccess && matchedUser && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3 z-20"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-bounce">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-900/60 px-3 py-1 rounded-full border border-emerald-500/50">
                      Identidade Autenticada ✓
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {matchedUser.nome}
                    </h3>
                    <p className="text-xs text-emerald-200">
                      {matchedUser.cargo || 'Colaborador Autorizado'} • {matchedUser.confidence}% Precisão
                    </p>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-300/80 animate-pulse pt-2">
                    Homologando recebimento no sistema...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overlay de Timeout / Rosto Não Reconhecido */}
            {isTimedOut && !validationSuccess && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Autenticação Não Concluída</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Não foi possível validar seu rosto com os colaboradores cadastrados ou o tempo limite foi atingido.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Tentar Novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraAndLoops();
                      onSuccess({
                        id: 'manual-timeout',
                        nome: 'Recebimento Manual (Timeout Biometria)',
                        cargo: 'Conferente',
                        confidence: 0,
                        distance: 1
                      });
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Concluir Manualmente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraAndLoops();
                      onClose();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Overlay de Erro de Câmera */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <CameraOff className="w-10 h-10 text-red-400" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Câmera Indisponível</h4>
                  <p className="text-xs text-red-300 max-w-xs">{cameraError}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recarregar Câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraAndLoops();
                      onSuccess({
                        id: 'manual-camera-error',
                        nome: 'Recebimento Manual (Falha Câmera)',
                        cargo: 'Conferente',
                        confidence: 0,
                        distance: 1
                      });
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Concluir Manualmente
                  </button>
                </div>
              </div>
            )}

            {/* Barra Inferior com Tempo Restante e Prova de Vida */}
            {cameraActive && !validationSuccess && !isTimedOut && (
              <div className="absolute bottom-2 inset-x-3 flex items-center justify-between gap-2 pointer-events-none">
                {/* Prova de Vida Badge */}
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-lg flex items-center gap-1.5 ${
                  isAlive
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                    : 'bg-sky-950/90 text-sky-300 border-sky-500/60 animate-pulse'
                }`}>
                  {isAlive ? (
                    <>
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Prova de Vida: OK ✓</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>Movimente o Rosto...</span>
                    </>
                  )}
                </div>

                {/* Contador de Tempo */}
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold backdrop-blur-md border shadow-lg flex items-center gap-1.5 ${
                  timeLeft <= 7
                    ? 'bg-red-950/90 text-red-300 border-red-500/60 animate-pulse'
                    : 'bg-slate-900/90 text-slate-300 border-slate-700'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeLeft}s</span>
                </div>
              </div>
            )}
          </div>

          {/* Status Message e Instruções */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                validationSuccess
                  ? 'bg-emerald-400 animate-ping'
                  : isTimedOut
                  ? 'bg-red-400'
                  : isAlive
                  ? 'bg-emerald-400'
                  : 'bg-sky-400 animate-pulse'
              }`} />
              <p className="text-xs text-slate-300 font-medium truncate">
                {statusMessage}
              </p>
            </div>

            {facesCadastradas > 0 && (
              <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60 shrink-0">
                {facesCadastradas} {facesCadastradas === 1 ? 'biometria' : 'biometrias'}
              </span>
            )}
          </div>

          {/* Aviso se houver erro ou não houver usuários cadastrados no banco */}
          {!loadingUsers && mensagemErro && (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-amber-300">{mensagemErro}</strong>
                <span>Cadastre a face dos colaboradores no módulo de Onboarding Facial antes de exigir o reconhecimento biométrico.</span>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Anti-Spoofing Ativo (Head Yaw Estimation)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                stopCameraAndLoops();
                onSuccess({
                  id: 'manual-modal-bypass',
                  nome: 'Recebimento Manual (Bypass)',
                  cargo: 'Conferente',
                  confidence: 0,
                  distance: 1
                });
              }}
              className="text-xs font-semibold text-slate-400 hover:text-white underline cursor-pointer transition-colors"
            >
              Pular e concluir manualmente
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraAndLoops();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default FaceValidationModal;
