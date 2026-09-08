/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ==============================================================================
 * RECONHECIMENTO FACIAL - ONBOARDING BIOMÉTRICO (ALMOXARIFADO CMPC)
 * ==============================================================================
 * 
 * INSTRUÇÃO SQL PARA O SUPABASE:
 * Execute o script SQL abaixo no Supabase SQL Editor para habilitar o suporte
 * à persistência do vetor biométrico (128-dimensional face embedding):
 * 
 * ```sql
 * ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS face_descriptor JSONB;
 * ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS face_cadastrado_em TIMESTAMPTZ;
 * 
 * -- Opcional: Caso utilize a tabela de permissões:
 * ALTER TABLE usuarios_permissoes ADD COLUMN IF NOT EXISTS face_descriptor JSONB;
 * ALTER TABLE usuarios_permissoes ADD COLUMN IF NOT EXISTS face_cadastrado_em TIMESTAMPTZ;
 * ```
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  CameraOff, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  ShieldCheck, 
  Scan, 
  User, 
  Sparkles, 
  Play, 
  Square, 
  RotateCcw, 
  Check, 
  ChevronDown, 
  Search, 
  ArrowLeft, 
  Video, 
  Zap,
  Eye,
  EyeOff,
  Shield,
  ShieldAlert,
  Fingerprint,
  Info,
  UserPlus,
  X
} from 'lucide-react';

export interface UsuarioBiometria {
  id: string | number;
  nome: string;
  email?: string;
  cargo?: string;
  perfil?: string;
  pin?: string;
  face_descriptor?: number[] | null;
  face_cadastrado_em?: string | null;
}

interface FaceOnboardingProps {
  onBack?: () => void;
}

export default function FaceOnboarding({ onBack }: FaceOnboardingProps) {
  // 1. Model Loading State
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // 2. Users State
  const [usersList, setUsersList] = useState<UsuarioBiometria[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // 2.1 Modal Novo Colaborador State
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserCargo, setNewUserCargo] = useState('');
  const [newUserPerfil, setNewUserPerfil] = useState<'ALMOXARIFADO' | 'ADMINISTRADOR' | 'RH'>('ALMOXARIFADO');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [newUserError, setNewUserError] = useState<string | null>(null);

  // 3. Camera & Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 4. Realtime Face Detection Metrics
  const [detectedFacesCount, setDetectedFacesCount] = useState<number>(0);
  const [faceConfidence, setFaceConfidence] = useState<number>(0);
  const [isRealtimeDetecting, setIsRealtimeDetecting] = useState(false);

  // 4.1 Liveness Detection State (Prova de Vida / Head Yaw Estimation)
  const [isAlive, setIsAlive] = useState(false);
  const [currentYawRatio, setCurrentYawRatio] = useState<number>(1.0);

  // 5. Capture & Persist State
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSuccess, setCaptureSuccess] = useState<{
    userName: string;
    timestamp: string;
    descriptorDimensions: number;
    snapshotUrl?: string;
  } | null>(null);

  // 6. Mode: 'enroll' (Cadastro) vs 'verify' (Testar Reconhecimento)
  const [activeMode, setActiveMode] = useState<'enroll' | 'verify'>('enroll');
  const [recognizedMatch, setRecognizedMatch] = useState<{
    user: UsuarioBiometria;
    distance: number;
    confidence: number;
  } | null>(null);

  // ============================================================================
  // CARREGAMENTO DOS MODELOS NEURAIS DO FACE-API.JS
  // ============================================================================
  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      setIsModelsLoading(true);
      setModelError(null);

      try {
        const MODEL_URL = '/models';
        console.log('[FaceOnboarding] Carregando modelos neurais de:', MODEL_URL);

        // Carrega as 3 redes essenciais para detecção, landmarks e extração do descritor de 128 dimensões
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        if (isMounted) {
          console.log('[FaceOnboarding] Modelos neurais carregados com sucesso!');
          setModelsLoaded(true);
          setIsModelsLoading(false);
        }
      } catch (err: any) {
        console.error('[FaceOnboarding] Erro ao carregar modelos neurais:', err);
        if (isMounted) {
          setModelError(
            err.message || 
            'Falha ao carregar os arquivos de modelo em /public/models. Verifique a integridade dos arquivos binários.'
          );
          setIsModelsLoading(false);
        }
      }
    }

    loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  // ============================================================================
  // BUSCA DA LISTA DE USUÁRIOS DO SISTEMA NO SUPABASE (TABELA 'usuarios')
  // ============================================================================
  const carregarUsuariosParaBiometria = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      // Busca os usuários do sistema, trazendo a flag/vetor se já possuem biometria ou não
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, perfil, cargo, face_descriptor, face_cadastrado_em')
        .order('nome', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted: UsuarioBiometria[] = data.map((u: any) => ({
          id: u.id,
          nome: u.nome || u.email?.split('@')[0] || 'Sem Nome',
          email: u.email,
          cargo: u.cargo || u.perfil || 'Colaborador Almoxarifado',
          perfil: u.perfil || 'ALMOXARIFADO',
          pin: u.pin,
          face_descriptor: u.face_descriptor,
          face_cadastrado_em: u.face_cadastrado_em
        }));

        setUsersList(formatted);
        if (!selectedUserId && formatted.length > 0) {
          setSelectedUserId(String(formatted[0].id));
        }
      } else {
        setUsersList([]);
      }
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [selectedUserId]);

  // Alias para manter compatibilidade com chamadas internas
  const fetchUsers = carregarUsuariosParaBiometria;

  useEffect(() => {
    carregarUsuariosParaBiometria();
  }, [carregarUsuariosParaBiometria]);

  // ============================================================================
  // CADASTRO DE NOVO COLABORADOR (INSERÇÃO DIRETA NA TABELA 'usuarios')
  // ============================================================================
  const handleCadastrarNovoUsuario = async (novoUsuario: { nome: string; cargo: string; perfil: string }) => {
    const trimmedNome = novoUsuario.nome.trim();
    if (!trimmedNome) {
      setNewUserError('Por favor, informe o nome completo do colaborador.');
      return;
    }

    setIsSubmittingNewUser(true);
    setNewUserError(null);

    try {
      const payload = {
        nome: trimmedNome,
        cargo: novoUsuario.cargo?.trim() || 'Colaborador Almoxarifado',
        perfil: novoUsuario.perfil || 'ALMOXARIFADO',
        status: 'ATIVO'
      };

      const { data, error } = await supabase
        .from('usuarios')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[FaceOnboarding] Erro ao cadastrar usuário no Supabase:', error);
        alert('Erro ao cadastrar usuário: ' + (error.message || 'Falha ao salvar no banco.'));
        setNewUserError(error.message || 'Erro ao cadastrar colaborador.');
        return;
      }

      // Atualiza a lista local de usuários para incluir o novo e o seleciona automaticamente
      const novoFormatado: UsuarioBiometria = {
        id: data.id,
        nome: data.nome,
        cargo: data.cargo,
        perfil: data.perfil,
        email: data.email,
        pin: data.pin,
        face_descriptor: null,
        face_cadastrado_em: null
      };

      setUsersList(prev => [novoFormatado, ...prev.filter(u => String(u.id) !== String(data.id))]);
      setSelectedUserId(String(data.id));
      setIsAlive(false);
      setCurrentYawRatio(1.0);
      setUserSearchTerm(''); // Limpa o filtro para o novo colaborador aparecer imediatamente
      
      // Limpa os estados do modal e fecha
      setNewUserName('');
      setNewUserCargo('');
      setNewUserPerfil('ALMOXARIFADO');
      setIsNewUserModalOpen(false);
    } catch (err: any) {
      console.error('[FaceOnboarding] Exceção ao cadastrar novo colaborador:', err);
      setNewUserError(err.message || 'Erro inesperado ao registrar colaborador.');
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // ============================================================================
  // ENUMERAÇÃO E INICIALIZAÇÃO DA CÂMERA WEBCAM
  // ============================================================================
  const listVideoDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoDevs);
      if (videoDevs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch (e) {
      console.warn('[FaceOnboarding] Não foi possível listar dispositivos:', e);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCaptureError(null);
    setIsAlive(false);
    setCurrentYawRatio(1.0);

    try {
      // Para streams anteriores se houver
      stopCamera();

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      await listVideoDevices();
    } catch (err: any) {
      console.error('[FaceOnboarding] Erro ao acessar webcam:', err);
      let msg = 'Erro ao inicializar a câmera. Verifique as permissões do navegador.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera de vídeo foi detectada no dispositivo.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setDetectedFacesCount(0);
    setFaceConfidence(0);
    setIsAlive(false);
    setCurrentYawRatio(1.0);
  };

  // Desliga a câmera ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ============================================================================
  // LOOP DE DETECÇÃO EM TEMPO REAL (OVERLAY VISUAL COM PROVA DE VIDA / EAR)
  // ============================================================================
  useEffect(() => {
    let active = true;

    const detectLoop = async () => {
      if (
        !active || 
        !isCameraActive || 
        !videoRef.current || 
        !canvasRef.current || 
        videoRef.current.paused || 
        videoRef.current.ended || 
        !modelsLoaded
      ) {
        if (active && isCameraActive) {
          animationFrameRef.current = requestAnimationFrame(detectLoop);
        }
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      // Sincroniza dimensões do canvas com o vídeo
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        setIsRealtimeDetecting(true);

        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        });

        // Detecção em tempo real
        if (activeMode === 'enroll') {
          const detections = await faceapi
            .detectAllFaces(video, options)
            .withFaceLandmarks();

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          setDetectedFacesCount(detections.length);

          if (detections.length > 0) {
            setFaceConfidence(Math.round(detections[0].detection.score * 100));

            // ====================================================================
            // PROVA DE VIDA ATIVA VIA HEAD YAW ESTIMATION
            // ====================================================================
            let calculatedYaw = 1.0;
            if (detections.length === 1 && detections[0].landmarks) {
              const landmarks = detections[0].landmarks;
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();
              const nose = landmarks.getNose();

              const leftEyeCornerX = leftEye[0].x; 
              const rightEyeCornerX = rightEye[3].x; 
              const noseTipX = nose[3].x; 

              const distLeft = Math.abs(noseTipX - leftEyeCornerX);
              const distRight = Math.abs(rightEyeCornerX - noseTipX);

              const yawRatio = distRight > 0 ? distLeft / distRight : 1.0;
              calculatedYaw = yawRatio;
              setCurrentYawRatio(Number(yawRatio.toFixed(2)));

              // LÓGICA ANTI-SPOOFING: Se o rosto estiver perfeitamente de frente, a razão é ~1.0.
              // Se virar para a direita ou esquerda, a razão dispara para cima de 1.6 ou cai para menos de 0.6.
              if (yawRatio > 1.6 || yawRatio < 0.6) {
                setIsAlive(true);
              }
            } else {
              setCurrentYawRatio(1.0);
            }

            // Desenha caixa visual customizada com cantos arredondados e cor dinâmica
            detections.forEach(det => {
              const box = det.detection.box;
              const isSingle = detections.length === 1;
              
              // Cores: Verde se Único + Prova de Vida OK | Azul Céu se Único aguardando piscar | Vermelho se múltiplos
              const strokeColor = isSingle 
                ? (isAlive ? '#10b981' : '#38bdf8')
                : '#ef4444';

              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 3;
              ctx.beginPath();
              
              // Desenha cantos estilizados tipo "Sci-Fi / Biometria"
              const cornerLen = Math.min(24, box.width / 4);
              
              // Top-Left
              ctx.moveTo(box.x, box.y + cornerLen);
              ctx.lineTo(box.x, box.y);
              ctx.lineTo(box.x + cornerLen, box.y);
              
              // Top-Right
              ctx.moveTo(box.x + box.width - cornerLen, box.y);
              ctx.lineTo(box.x + box.width, box.y);
              ctx.lineTo(box.x + box.width, box.y + cornerLen);
              
              // Bottom-Right
              ctx.moveTo(box.x + box.width, box.y + box.height - cornerLen);
              ctx.lineTo(box.x + box.width, box.y + box.height);
              ctx.lineTo(box.x + box.width - cornerLen, box.y + box.height);
              
              // Bottom-Left
              ctx.moveTo(box.x + cornerLen, box.y + box.height);
              ctx.lineTo(box.x, box.y + box.height);
              ctx.lineTo(box.x, box.y + box.height - cornerLen);

              ctx.stroke();

              // Badge superior com instrução e métricas
              ctx.fillStyle = isSingle 
                ? (isAlive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(14, 165, 233, 0.9)')
                : 'rgba(239, 68, 68, 0.9)';
              ctx.font = 'bold 12px Inter, sans-serif';
              
              const label = isSingle 
                ? (isAlive 
                    ? `Prova de Vida OK ✓ • ${Math.round(det.detection.score * 100)}%` 
                    : `Movimente o rosto levemente para um dos lados`)
                : 'Múltiplos Rostos!';
                
              ctx.fillRect(box.x, Math.max(0, box.y - 24), ctx.measureText(label).width + 16, 20);
              ctx.fillStyle = '#ffffff';
              ctx.fillText(label, box.x + 8, Math.max(14, box.y - 10));
            });
          } else {
            setFaceConfidence(0);
            setCurrentYawRatio(1.0);
          }
        } else if (activeMode === 'verify') {
          // Modo de Teste e Reconhecimento ao Vivo
          const detection = await faceapi
            .detectSingleFace(video, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            setDetectedFacesCount(1);
            setFaceConfidence(Math.round(detection.detection.score * 100));

            // Monitora rotação lateral também no modo de verificação
            if (detection.landmarks) {
              const leftEye = detection.landmarks.getLeftEye();
              const rightEye = detection.landmarks.getRightEye();
              const nose = detection.landmarks.getNose();

              const leftEyeCornerX = leftEye[0].x; 
              const rightEyeCornerX = rightEye[3].x; 
              const noseTipX = nose[3].x; 

              const distLeft = Math.abs(noseTipX - leftEyeCornerX);
              const distRight = Math.abs(rightEyeCornerX - noseTipX);

              const yawRatio = distRight > 0 ? distLeft / distRight : 1.0;
              setCurrentYawRatio(Number(yawRatio.toFixed(2)));

              if (yawRatio > 1.6 || yawRatio < 0.6) {
                setIsAlive(true);
              }
            }

            // Compara com os usuários cadastrados
            const registeredUsers = usersList.filter(u => u.face_descriptor && Array.isArray(u.face_descriptor));
            let bestMatch: { user: UsuarioBiometria; distance: number } | null = null;

            for (const u of registeredUsers) {
              if (u.face_descriptor) {
                const distance = faceapi.euclideanDistance(
                  detection.descriptor,
                  new Float32Array(u.face_descriptor)
                );

                if (!bestMatch || distance < bestMatch.distance) {
                  bestMatch = { user: u, distance };
                }
              }
            }

            const box = detection.detection.box;
            const threshold = 0.55; // Limiar de distância euclidiana

            if (bestMatch && bestMatch.distance <= threshold) {
              const confidence = Math.round((1 - bestMatch.distance) * 100);
              setRecognizedMatch({
                user: bestMatch.user,
                distance: bestMatch.distance,
                confidence
              });

              // Caixa verde de sucesso
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              const label = `Identificado: ${bestMatch.user.nome} (${confidence}%)`;
              ctx.fillStyle = '#10b981';
              ctx.fillRect(box.x, Math.max(0, box.y - 24), ctx.measureText(label).width + 16, 22);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px Inter, sans-serif';
              ctx.fillText(label, box.x + 8, Math.max(15, box.y - 8));
            } else {
              setRecognizedMatch(null);
              // Caixa amarela não identificado
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              const label = 'Rosto não cadastrado';
              ctx.fillStyle = '#f59e0b';
              ctx.fillRect(box.x, Math.max(0, box.y - 24), ctx.measureText(label).width + 16, 22);
              ctx.fillStyle = '#000000';
              ctx.font = 'bold 12px Inter, sans-serif';
              ctx.fillText(label, box.x + 8, Math.max(15, box.y - 8));
            }
          } else {
            setDetectedFacesCount(0);
            setFaceConfidence(0);
            setRecognizedMatch(null);
            setCurrentYawRatio(1.0);
          }
        }
      } catch (err) {
        console.warn('[FaceOnboarding] Erro na detecção em tempo real:', err);
      } finally {
        setIsRealtimeDetecting(false);
      }

      if (active && isCameraActive) {
        // Throttle suave de ~100ms para poupar CPU/GPU
        setTimeout(() => {
          if (active) animationFrameRef.current = requestAnimationFrame(detectLoop);
        }, 100);
      }
    };

    if (isCameraActive && modelsLoaded) {
      detectLoop();
    }

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, modelsLoaded, activeMode, usersList]);

  // ============================================================================
  // PERSISTÊNCIA DA BIOMETRIA NO BANCO (UPDATE NA TABELA 'usuarios')
  // ============================================================================
  const salvarBiometria = async (descriptor: Float32Array | number[], usuarioSelecionadoId: string | number) => {
    try {
      // O descriptor do face-api é um Float32Array. Precisamos converter para Array normal para salvar como JSONB no Supabase.
      const vetorBiometrico = Array.from(descriptor);
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from('usuarios')
        .update({ 
          face_descriptor: vetorBiometrico,
          // Registrar a data exata do cadastro da biometria
          face_cadastrado_em: timestamp 
        })
        .eq('id', usuarioSelecionadoId);

      if (error) throw error;

      // Atualiza a lista lateral para o card do usuário ficar verdinho ("Cadastrado")
      await carregarUsuariosParaBiometria();

      return { timestamp, dimensions: vetorBiometrico.length };
    } catch (err) {
      console.error("Erro ao salvar biometria no usuário:", err);
      throw err;
    }
  };

  // ============================================================================
  // CAPTURA, PROCESSAMENTO E PERSISTÊNCIA NO SUPABASE
  // ============================================================================
  const handleCaptureAndSave = async () => {
    if (!videoRef.current || !isCameraActive) {
      setCaptureError('A câmera precisa estar ligada para realizar a captura.');
      return;
    }

    const selectedUser = usersList.find(u => String(u.id) === selectedUserId);
    if (!selectedUser) {
      setCaptureError('Por favor, selecione um usuário da lista para vincular a biometria.');
      return;
    }

    if (!isAlive) {
      setCaptureError('Prova de Vida Obrigatória: Movimente o rosto levemente para um dos lados em frente à câmera para confirmar presença física real e evitar fraudes com fotos estáticas.');
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);
    setCaptureSuccess(null);

    try {
      const video = videoRef.current;

      // Opções precisas para captura oficial
      const detectorOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5
      });

      console.log('[FaceOnboarding] Iniciando extração do vetor facial para:', selectedUser.nome);

      // Detecta todas as faces presentes na cena com landmarks e descritores
      const fullFaceDetections = await faceapi
        .detectAllFaces(video, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // 1. Validação de ausência de rosto
      if (fullFaceDetections.length === 0) {
        throw new Error(
          'Nenhum rosto detectado na câmera! Centralize seu rosto no enquadramento e certifique-se de estar em um ambiente bem iluminado.'
        );
      }

      // 2. Validação de múltiplos rostos (segurança estrita)
      if (fullFaceDetections.length > 1) {
        throw new Error(
          `Múltiplos rostos detectados (${fullFaceDetections.length})! Por segurança, apenas uma pessoa deve estar visível na câmera durante o cadastro biométrico.`
        );
      }

      const singleDetection = fullFaceDetections[0];

      // Gera um snapshot em base64 para preview imediato na interface
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      }
      const snapshotUrl = tempCanvas.toDataURL('image/jpeg', 0.85);

      // Salva diretamente na tabela usuarios
      const { timestamp, dimensions } = await salvarBiometria(singleDetection.descriptor, selectedUser.id);

      setCaptureSuccess({
        userName: selectedUser.nome,
        timestamp,
        descriptorDimensions: dimensions,
        snapshotUrl
      });
    } catch (err: any) {
      console.error('[FaceOnboarding] Falha na captura/gravação:', err);
      setCaptureError(err.message || 'Erro inesperado ao processar biometria facial.');
    } finally {
      setIsCapturing(false);
    }
  };

  const selectedUserObj = usersList.find(u => String(u.id) === selectedUserId);

  const filteredUsers = usersList.filter(u =>
    u.nome.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (u.perfil && u.perfil.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
    (u.cargo && u.cargo.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(userSearchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="face-onboarding-root">
      
      {/* Top Gradient Banner */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-600 to-violet-600 w-full" />

      {/* Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-700"
                title="Voltar ao Painel"
                id="btn-back-onboarding"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="p-2.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-2xl shadow-inner">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-50">
                  Onboarding Facial • Almoxarifado
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-md">
                  face-api.js
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cadastro biométrico de operadores e almoxarifes para liberação rápida de ferramentas e ativos
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80">
            <button
              onClick={() => {
                setActiveMode('enroll');
                setRecognizedMatch(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'enroll'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-mode-enroll"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Cadastrar Biometria</span>
            </button>
            <button
              onClick={() => {
                setActiveMode('verify');
                setCaptureSuccess(null);
              }}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === 'verify'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-mode-verify"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Testar Reconhecimento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* Model Loading Status Banner */}
        {isModelsLoading && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  Carregando Redes Neurais de IA...
                </h4>
                <p className="text-xs text-slate-400">
                  Inicializando TinyFaceDetector, Landmarks e FaceRecognitionNet a partir de <code className="text-indigo-300 font-mono">/public/models</code>
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-950/70 border border-indigo-800 px-2.5 py-1 rounded-lg">
              Carregando Pesos...
            </span>
          </motion.div>
        )}

        {modelError && (
          <div className="bg-red-950/70 border border-red-800 rounded-2xl p-4 flex items-start gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-red-300 uppercase tracking-wider">
                Falha ao Carregar Modelos de Reconhecimento
              </h4>
              <p>{modelError}</p>
              <p className="text-slate-400 text-[11px]">
                Certifique-se de que os arquivos de manifesto e shards binários estão presentes em <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">/public/models</code>.
              </p>
            </div>
          </div>
        )}

        {/* Workspace Layout: Left Column (Controls & User Selection) / Right Column (Camera Viewport) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (5 Cols): User Picker & Instructions */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* User Selection Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                    {activeMode === 'enroll' ? '1. Seleção do Colaborador' : 'Base de Usuários Cadastrados'}
                  </h3>
                </div>
                <button
                  onClick={fetchUsers}
                  disabled={isLoadingUsers}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  title="Atualizar lista de usuários"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>

              {/* Search User Input & "+ Novo Colaborador" Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome, cargo ou e-mail..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
                    id="input-search-colaborador"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewUserName('');
                    setNewUserCargo('');
                    setNewUserPerfil('ALMOXARIFADO');
                    setNewUserError(null);
                    setIsNewUserModalOpen(true);
                  }}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
                  id="btn-abrir-novo-colaborador"
                  title="Cadastrar novo colaborador diretamente no Supabase"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Novo Colaborador</span>
                </button>
              </div>

              {/* Users List Container */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {isLoadingUsers ? (
                  <div className="p-6 text-center text-slate-500 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-500" />
                    <p className="text-xs">Buscando equipe no Supabase...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs bg-slate-950/60 rounded-2xl border border-slate-800">
                    Nenhum colaborador encontrado com o filtro "{userSearchTerm}".
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelected = String(user.id) === selectedUserId;
                    const hasBiometric = Boolean(user.face_descriptor && user.face_descriptor.length > 0);

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(String(user.id));
                          setIsAlive(false);
                          setCurrentYawRatio(1.0);
                        }}
                        className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-md'
                            : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate text-slate-100">{user.nome}</span>
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                            <span className="capitalize">{user.perfil?.toLowerCase() || user.cargo || 'Almoxarifado'}</span>
                            {user.email && (
                              <>
                                <span>•</span>
                                <span className="truncate">{user.email}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 flex items-center">
                          {hasBiometric ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Cadastrado</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-950/50 text-amber-400 border border-amber-800/50 rounded-md">
                              Pendente
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Selected User Details Card */}
              {selectedUserObj && activeMode === 'enroll' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Alvo Selecionado para Vínculo Biométrico:
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-emerald-400">{selectedUserObj.nome}</h4>
                      <p className="text-[11px] text-slate-400 capitalize">{selectedUserObj.perfil?.toLowerCase() || selectedUserObj.cargo || 'Almoxarifado'}</p>
                    </div>
                    {selectedUserObj.face_descriptor && (
                      <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                        Vetor 128-D Presente
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SQL Info / Quick Notes Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Info className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Instruções & Segurança Anti-Spoofing
                </h4>
              </div>
              <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                <li>Posicione o rosto no centro da moldura na câmera.</li>
                <li><strong className="text-sky-300">Prova de Vida Ativa:</strong> Movimente o rosto levemente para um dos lados para validar presença física real e impedir uso de fotos estáticas.</li>
                <li>Garanta que não há outras pessoas ao fundo na câmera.</li>
                <li>Evite óculos escuros, máscaras ou iluminação traseira excessiva.</li>
                <li>O vetor biométrico de 128 dimensões é salvo no Supabase.</li>
              </ul>
              
              <div className="pt-2 border-t border-slate-800">
                <details className="text-[11px] text-slate-500 cursor-pointer">
                  <summary className="font-semibold text-slate-400 hover:text-slate-300">
                    Ver instrução SQL para Supabase
                  </summary>
                  <pre className="mt-2 bg-slate-950 p-2.5 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS face_descriptor JSONB,
ADD COLUMN IF NOT EXISTS face_cadastrado_em TIMESTAMPTZ;`}
                  </pre>
                </details>
              </div>
            </div>

          </div>

          {/* Right Column (7 Cols): Live Video Viewport & Capture Trigger */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Viewport Frame */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              
              {/* Header inside Viewport */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                    {activeMode === 'enroll' ? '2. Câmera de Captura com Prova de Vida' : 'Scanner de Reconhecimento em Tempo Real'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-1 bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Desligar Câmera</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={!modelsLoaded}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                      id="btn-start-camera"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Ligar Câmera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Camera Selector (if multiple devices) */}
              {availableDevices.length > 1 && isCameraActive && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Dispositivo:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      setTimeout(startCamera, 100);
                    }}
                    className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-2.5 py-1 text-xs outline-none"
                  >
                    {availableDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Câmera ${d.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Viewport Box */}
              <div className="relative aspect-[4/3] w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
                
                {/* Realtime Video Stream */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover transform -scale-x-100 ${!isCameraActive ? 'hidden' : ''}`}
                />

                {/* Canvas Overlay for Face Bounding Boxes & Sci-Fi Tracking */}
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-10 ${
                    !isCameraActive ? 'hidden' : ''
                  }`}
                />

                {/* Biometric Oval Guide / Grid overlay when camera is on */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center">
                    {/* Reticle / Oval Guide */}
                    <div 
                      className={`w-52 h-64 sm:w-60 sm:h-72 rounded-[48%] border-2 transition-all duration-300 flex items-center justify-center ${
                        detectedFacesCount === 1
                          ? (isAlive 
                              ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)] bg-emerald-500/5' 
                              : 'border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.35)] bg-sky-500/5')
                          : detectedFacesCount > 1
                          ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)] bg-red-500/5'
                          : 'border-slate-500/50 border-dashed bg-slate-900/20'
                      }`}
                    >
                      {/* Crosshairs */}
                      <div className={`w-3 h-3 border-t-2 border-l-2 absolute top-4 left-4 ${isAlive ? 'border-emerald-400/80' : 'border-sky-400/80'}`} />
                      <div className={`w-3 h-3 border-t-2 border-r-2 absolute top-4 right-4 ${isAlive ? 'border-emerald-400/80' : 'border-sky-400/80'}`} />
                      <div className={`w-3 h-3 border-b-2 border-l-2 absolute bottom-4 left-4 ${isAlive ? 'border-emerald-400/80' : 'border-sky-400/80'}`} />
                      <div className={`w-3 h-3 border-b-2 border-r-2 absolute bottom-4 right-4 ${isAlive ? 'border-emerald-400/80' : 'border-sky-400/80'}`} />
                    </div>

                    {/* Status Pill Badge at bottom of viewport */}
                    <div className="absolute bottom-4 inset-x-0 flex justify-center px-4">
                      {detectedFacesCount === 1 ? (
                        isAlive ? (
                          <div className="px-3.5 py-1.5 bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
                            <Shield className="w-4 h-4 text-emerald-400" />
                            <span>Prova de Vida Confirmada • {faceConfidence}% Precisão</span>
                          </div>
                        ) : (
                          <div className="px-3.5 py-1.5 bg-sky-950/90 text-sky-300 border border-sky-500/60 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg animate-pulse">
                            <Eye className="w-4 h-4 text-sky-400" />
                            <span>Movimente o rosto levemente para um dos lados</span>
                          </div>
                        )
                      ) : detectedFacesCount > 1 ? (
                        <div className="px-3.5 py-1.5 bg-red-950/90 text-red-400 border border-red-500/60 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span>Múltiplos Rostos! Deixe apenas 1 pessoa</span>
                        </div>
                      ) : (
                        <div className="px-3.5 py-1.5 bg-slate-900/90 text-slate-300 border border-slate-700 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
                          <Scan className="w-4 h-4 text-slate-400" />
                          <span>Centralize seu rosto na moldura</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Idle / Camera Off State */}
                {!isCameraActive && (
                  <div className="text-center p-6 space-y-3 z-10">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-300">Câmera em Modo de Espera</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Clique em "Ligar Câmera" para ativar a detecção facial, realizar a prova de vida e capturar a assinatura biométrica.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={!modelsLoaded}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Ativar Câmera</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Liveness Telemetry & Anti-Spoofing Card (When enrolling and camera is on) */}
              {activeMode === 'enroll' && isCameraActive && (
                <div className={`p-4 rounded-2xl border transition-all ${
                  isAlive 
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/30' 
                    : 'bg-slate-950 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border ${
                        isAlive 
                          ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' 
                          : 'bg-sky-950/80 text-sky-400 border-sky-800'
                      }`}>
                        {isAlive ? <Shield className="w-4 h-4" /> : <Eye className="w-4 h-4 animate-pulse" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                            Prova de Vida (Head Yaw Estimation)
                          </h4>
                          {isAlive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-900/80 text-emerald-300 border border-emerald-600 rounded-md">
                              Confirmada ✓
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-700 rounded-md animate-pulse">
                              Aguardando Movimento...
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isAlive 
                            ? 'Presença física real autenticada por movimentação lateral! Pronto para salvar.' 
                            : 'Movimente o rosto levemente para um dos lados em frente à webcam para provar presença real e desbloquear a captura.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">Yaw Ratio</span>
                        <span className={`text-xs font-mono font-bold ${currentYawRatio > 1.6 || currentYawRatio < 0.6 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {currentYawRatio > 0 ? currentYawRatio.toFixed(2) : '--'}
                        </span>
                      </div>
                      {isAlive && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAlive(false);
                            setCurrentYawRatio(1.0);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
                          title="Reiniciar prova de vida para testar novamente"
                        >
                          Refazer Prova
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Error Banner */}
              {cameraError && (
                <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3.5 flex items-center gap-3 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Capture Error Banner */}
              {captureError && (
                <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3.5 flex items-center gap-3 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{captureError}</span>
                </div>
              )}

              {/* Capture Success Modal / Notification */}
              {captureSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-950/60 border border-emerald-500/80 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Biometria Facial Gravada com Sucesso!
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded">
                      Vetor {captureSuccess.descriptorDimensions}-D
                    </span>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    {captureSuccess.snapshotUrl && (
                      <img
                        src={captureSuccess.snapshotUrl}
                        alt="Foto do rosto capturado"
                        className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500/60 shrink-0 transform -scale-x-100"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-slate-100">
                        Colaborador: <span className="text-emerald-400">{captureSuccess.userName}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Horário de Registro: {new Date(captureSuccess.timestamp).toLocaleTimeString('pt-BR')}
                      </p>
                      <p className="text-[11px] text-emerald-300 font-medium">
                        O colaborador já pode autenticar e assinar movimentações por face no almoxarifado.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('verify');
                        setCaptureSuccess(null);
                      }}
                      className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Testar Reconhecimento Agora</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptureSuccess(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Mode Verification Active Card */}
              {activeMode === 'verify' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Status do Reconhecimento ao Vivo:
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-950 text-violet-400 border border-violet-800 rounded-md">
                      Modo Verificação
                    </span>
                  </div>

                  {recognizedMatch ? (
                    <div className="p-3 bg-emerald-950/50 border border-emerald-500 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <h4 className="font-black text-xs uppercase">{recognizedMatch.user.nome}</h4>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {recognizedMatch.user.cargo || 'Almoxarifado'} • Distância Euclidiana: {recognizedMatch.distance.toFixed(3)}
                        </p>
                      </div>
                      <span className="text-xs font-black font-mono px-2.5 py-1 bg-emerald-900/80 text-emerald-300 border border-emerald-700 rounded-lg">
                        {recognizedMatch.confidence}% Match
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                      {isCameraActive 
                        ? 'Aponte o rosto para a câmera para testar a correspondência biométrica...'
                        : 'Ligue a câmera para iniciar o scanner de reconhecimento.'}
                    </div>
                  )}
                </div>
              )}

              {/* Primary Action Button */}
              {activeMode === 'enroll' && (
                <button
                  type="button"
                  onClick={handleCaptureAndSave}
                  disabled={!isCameraActive || isCapturing || !modelsLoaded || !isAlive || !selectedUserId || detectedFacesCount !== 1}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !isCameraActive || isCapturing || !modelsLoaded || !selectedUserId || detectedFacesCount !== 1
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : !isAlive
                      ? 'bg-sky-950 text-sky-300 border border-sky-600/70 hover:bg-sky-900/60 shadow-lg cursor-pointer animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/60'
                  }`}
                  id="btn-capture-biometrics"
                >
                  {isCapturing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extraindo Vetor de 128 Dimensões...</span>
                    </>
                  ) : !selectedUserId ? (
                    <>
                      <User className="w-4 h-4" />
                      <span>Selecione um Colaborador na Lista</span>
                    </>
                  ) : !isCameraActive ? (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Ative a Câmera para Iniciar</span>
                    </>
                  ) : detectedFacesCount === 0 ? (
                    <>
                      <Scan className="w-4 h-4" />
                      <span>Posicione o Rosto no Centro</span>
                    </>
                  ) : detectedFacesCount > 1 ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>Deixe Apenas 1 Pessoa na Câmera</span>
                    </>
                  ) : !isAlive ? (
                    <>
                      <Eye className="w-4 h-4 text-sky-400 animate-bounce" />
                      <span>Movimente o Rosto para Desbloquear Captura</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Capturar e Gravar Biometria de {selectedUserObj?.nome || 'Usuário'}</span>
                    </>
                  )}
                </button>
              )}

            </div>

          </div>

        </div>

      </main>

      {/* ===================================================================== */}
      {/* MODAL DE CADASTRO DE NOVO COLABORADOR                                */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isNewUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop com desfoque e escurecimento */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSubmittingNewUser) setIsNewUserModalOpen(false);
              }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Caixa de Diálogo do Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100 z-10"
              id="modal-novo-colaborador"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-2xl">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                      Novo Colaborador
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cadastre o usuário e inicie a captura biométrica
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  disabled={isSubmittingNewUser}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  id="btn-fechar-modal-novo-usuario"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Banner se houver */}
              {newUserError && (
                <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{newUserError}</span>
                </div>
              )}

              {/* Formulário de Cadastro */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCadastrarNovoUsuario({
                    nome: newUserName,
                    cargo: newUserCargo,
                    perfil: newUserPerfil
                  });
                }}
                className="space-y-4"
              >
                {/* 1. Nome Completo (Obrigatório) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Nome Completo <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                    id="input-novo-usuario-nome"
                  />
                </div>

                {/* 2. Cargo (Opcional) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Cargo / Função <span className="text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Almoxarife, Operador, Auxiliar de Logística..."
                    value={newUserCargo}
                    onChange={(e) => setNewUserCargo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                    id="input-novo-usuario-cargo"
                  />
                </div>

                {/* 3. Perfil de Acesso (Dropdown) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Perfil
                  </label>
                  <select
                    value={newUserPerfil}
                    onChange={(e) => setNewUserPerfil(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs text-slate-100 outline-none transition-all cursor-pointer"
                    id="select-novo-usuario-perfil"
                  >
                    <option value="ALMOXARIFADO">ALMOXARIFADO (Padrão)</option>
                    <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                    <option value="RH">RH</option>
                  </select>
                </div>

                {/* Ações / Botões */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsNewUserModalOpen(false)}
                    disabled={isSubmittingNewUser}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer disabled:opacity-50"
                    id="btn-cancelar-novo-usuario"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingNewUser || !newUserName.trim()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-emerald-950/60 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    id="btn-salvar-novo-usuario"
                  >
                    {isSubmittingNewUser ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Cadastrando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Cadastrar Colaborador</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
