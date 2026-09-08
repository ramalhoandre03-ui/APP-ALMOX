import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import * as faceapi from 'face-api.js';
import { 
  Shield, 
  Lock, 
  Mail, 
  User, 
  KeyRound, 
  AlertCircle, 
  CheckCircle, 
  CheckCircle2,
  Loader2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ScanFace,
  Camera,
  RefreshCw,
  Sparkles,
  X,
  ArrowLeft
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import WarehouseLoader from './WarehouseLoader';

export default function LoginGatekeeper() {
  const { session, login, loginBiometric, register, logout, isLoading } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // ============================================================================
  // ESTADOS DO MOTOR BIOMÉTRICO (FACE-API.JS)
  // ============================================================================
  const [modoBiometricoAtivo, setModoBiometricoAtivo] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isBioCameraActive, setIsBioCameraActive] = useState(false);
  const [bioCameraError, setBioCameraError] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [usersWithBio, setUsersWithBio] = useState<any[]>([]);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [facesCadastradas, setFacesCadastradas] = useState<number>(0);
  const [isAlive, setIsAlive] = useState(false);
  const [currentYawRatio, setCurrentYawRatio] = useState<number>(1.0);
  const [detectedFacesCount, setDetectedFacesCount] = useState<number>(0);
  const [usuarioReconhecido, setUsuarioReconhecido] = useState<any | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Refs de Câmera e Canvas
  const bioVideoRef = useRef<HTMLVideoElement | null>(null);
  const bioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bioStreamRef = useRef<MediaStream | null>(null);
  const bioAnimFrameRef = useRef<number | null>(null);

  // ============================================================================
  // CARREGAMENTO DOS MODELOS NEURAIS FACE-API.JS
  // ============================================================================
  useEffect(() => {
    if (!modoBiometricoAtivo || modelsLoaded) return;

    let isMounted = true;
    const carregarModelos = async () => {
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
        console.error('[LoginGatekeeper] Erro ao carregar modelos face-api:', err);
        if (isMounted) {
          setBiometricError('Falha ao carregar modelos neurais de reconhecimento facial.');
          setIsLoadingModels(false);
        }
      }
    };

    carregarModelos();
    return () => {
      isMounted = false;
    };
  }, [modoBiometricoAtivo, modelsLoaded]);

  // ============================================================================
  // ORDEM 1: CORRIGIR O FETCH DE ROSTOS (TABELA 1 - USUARIOS COM VÍNCULO)
  // ============================================================================
  const carregarBaseBiometrica = useCallback(async () => {
    setLoadingUsers(true);
    setBiometricError(null);
    try {
      const { data: baseRostos, error } = await supabase
        .from('usuarios')
        .select('id, nome, face_descriptor, id_biometria_vinculada')
        .not('face_descriptor', 'is', null)
        .not('id_biometria_vinculada', 'is', null); // Só carrega quem tem o vínculo com a tabela de permissões

      if (error) {
        console.warn('[LoginGatekeeper] Erro ao carregar base de rostos de usuarios:', error);
        throw error;
      }

      if (!baseRostos || baseRostos.length === 0) {
        console.warn("[LoginGatekeeper] Nenhum usuário com biometria vinculada foi retornado.");
        setFacesCadastradas(0);
        setFaceMatcher(null);
        setUsersWithBio([]);
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

          let cleanValues: number[] = [];
          if (descriptorData && typeof descriptorData === 'object' && !Array.isArray(descriptorData)) {
            cleanValues = Object.values(descriptorData).map(Number);
          } else if (Array.isArray(descriptorData)) {
            cleanValues = descriptorData.map(Number);
          }

          if (cleanValues.length > 0) {
            const float32Array = new Float32Array(cleanValues);
            // Embutimos o ID/UUID de acesso no label para usarmos após o match
            const labelData = JSON.stringify({ 
              nome: user.nome || 'Colaborador', 
              idAcesso: user.id_biometria_vinculada 
            });

            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(labelData, [float32Array]));
            formattedUsers.push({
              id: user.id,
              nome: user.nome,
              idAcesso: user.id_biometria_vinculada,
              face_descriptor: cleanValues,
              parsedDescriptor: float32Array
            });
          }
        } catch (convErr) {
          console.error('[LoginGatekeeper] Erro ao converter descritor facial:', user.nome, convErr);
        }
      });

      if (labeledDescriptors.length > 0) {
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        setFaceMatcher(matcher);
      } else {
        setFaceMatcher(null);
      }

      setFacesCadastradas(baseRostos.length); // Agora vai mostrar as faces corretamente!
      setUsersWithBio(formattedUsers);
      setLoadingUsers(false);
    } catch (err: any) {
      console.error("[LoginGatekeeper] Erro ao carregar base biométrica:", err);
      setLoadingUsers(false);
      setBiometricError('Erro ao consultar banco de dados biométrico.');
    }
  }, []);

  // ============================================================================
  // CONTROLE DA WEBCAM (INICIALIZAÇÃO & CANCELAMENTO/PARADA)
  // ============================================================================
  const stopBioCamera = useCallback(() => {
    if (bioAnimFrameRef.current) {
      cancelAnimationFrame(bioAnimFrameRef.current);
      bioAnimFrameRef.current = null;
    }
    if (bioStreamRef.current) {
      bioStreamRef.current.getTracks().forEach(t => t.stop());
      bioStreamRef.current = null;
    }
    if (bioVideoRef.current) {
      bioVideoRef.current.srcObject = null;
    }
    setIsBioCameraActive(false);
    setDetectedFacesCount(0);
    setIsAlive(false);
    setCurrentYawRatio(1.0);
  }, []);

  const startBioCamera = useCallback(async () => {
    setBioCameraError(null);
    setBiometricError(null);
    setIsAlive(false);
    setCurrentYawRatio(1.0);
    setUsuarioReconhecido(null);

    carregarBaseBiometrica();

    try {
      if (bioStreamRef.current) {
        bioStreamRef.current.getTracks().forEach(t => t.stop());
        bioStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      bioStreamRef.current = stream;

      if (bioVideoRef.current) {
        bioVideoRef.current.srcObject = stream;
        await bioVideoRef.current.play();
        setIsBioCameraActive(true);
      }
    } catch (err: any) {
      console.error('[LoginGatekeeper] Erro ao acessar webcam:', err);
      let msg = 'Erro ao inicializar a câmera. Verifique as permissões do navegador.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera de vídeo foi detectada no dispositivo.';
      }
      setBioCameraError(msg);
      setIsBioCameraActive(false);
    }
  }, [carregarBaseBiometrica]);

  // Disparo ao abrir o modal biométrico
  useEffect(() => {
    if (modoBiometricoAtivo && modelsLoaded && !isBioCameraActive && !bioCameraError && !usuarioReconhecido) {
      startBioCamera();
    }
  }, [modoBiometricoAtivo, modelsLoaded, isBioCameraActive, bioCameraError, usuarioReconhecido, startBioCamera]);

  // Fechamento de segurança ao desmontar ou fechar o modal
  useEffect(() => {
    if (!modoBiometricoAtivo) {
      stopBioCamera();
    }
    return () => {
      stopBioCamera();
    };
  }, [modoBiometricoAtivo, stopBioCamera]);

  // ============================================================================
  // ORDEM 2: BUSCAR PERMISSÕES E LOGAR (TABELA 2 - USUARIOS_PERMISSOES)
  // ============================================================================
  const handleMatchSucesso = useCallback(async (dadosRosto: any) => {
    setIsAuthenticating(true);

    try {
      // 1. O dadosRosto.idAcesso é o ID/UUID que estava na coluna id_biometria_vinculada
      const { data: dadosAcesso, error } = await supabase
        .from('usuarios_permissoes')
        .select('*')
        .eq('id', dadosRosto.idAcesso) // Busca na tabela de permissões pelo ID
        .single();

      if (error || !dadosAcesso) {
        console.warn('[LoginGatekeeper] Rosto reconhecido, mas vínculo de permissão não encontrado:', dadosRosto.idAcesso, error);
        setAlertMsg({ type: 'error', text: 'Rosto reconhecido, mas vínculo de permissão não encontrado no sistema!' });
        setIsAuthenticating(false);
        return;
      }

      setUsuarioReconhecido(dadosAcesso);

      // 2. Injeta os dados da tabela usuarios_permissoes no contexto da aplicação
      if (loginBiometric) {
        await loginBiometric(dadosAcesso);
      } else if (login) {
        // Fallback context
        await (login as any)(dadosAcesso);
      }

      // 3. Redireciona para o Hub
      if (typeof window !== 'undefined') {
        try {
          window.history.pushState({}, '', '/dashboard');
        } catch {}
      }

      stopBioCamera();
      setModoBiometricoAtivo(false);
    } catch (err: any) {
      console.error("Erro ao efetivar login biométrico:", err);
      setAlertMsg({ type: 'error', text: 'Erro ao efetivar autenticação biométrica.' });
    } finally {
      setIsAuthenticating(false);
    }
  }, [loginBiometric, login, stopBioCamera]);

  // ============================================================================
  // LOOP DE RECONHECIMENTO FACIAL AO VIVO + PROVA DE VIDA (YAW + MATCHER 0.6)
  // ============================================================================
  useEffect(() => {
    if (!modoBiometricoAtivo || !isBioCameraActive || !modelsLoaded || usuarioReconhecido || isAuthenticating) {
      return;
    }

    let isRunning = true;

    const detectAndMatch = async () => {
      if (!isRunning || !bioVideoRef.current || !bioCanvasRef.current) return;

      const video = bioVideoRef.current;
      const canvas = bioCanvasRef.current;

      if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        });

        const detection = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          setDetectedFacesCount(1);
          const box = detection.detection.box;

          // Prova de Vida: Assimetria do nariz vs cantos dos olhos (Yaw Ratio)
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

            // Se virar para a direita ou esquerda (anti-spoofing)
            if (yawRatio > 1.6 || yawRatio < 0.6) {
              setIsAlive(true);
            }
          }

          // Busca Biometria com FaceMatcher (Tolerância 0.6)
          let bestMatchUser: any = null;
          let matchDistance = 1.0;

          if (faceMatcher && detection.descriptor) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance <= 0.6) {
              try {
                const parsed = JSON.parse(bestMatch.label);
                bestMatchUser = parsed;
                matchDistance = bestMatch.distance;
              } catch {
                const found = usersWithBio.find(
                  u => u.nome === bestMatch.label || String(u.id) === bestMatch.label
                );
                if (found) {
                  bestMatchUser = found;
                  matchDistance = bestMatch.distance;
                }
              }
            }
          }

          // Fallback Euclidiano
          if (!bestMatchUser && usersWithBio.length > 0 && detection.descriptor) {
            for (const u of usersWithBio) {
              const targetDesc = u.parsedDescriptor || (u.face_descriptor ? new Float32Array(u.face_descriptor) : null);
              if (targetDesc) {
                const dist = faceapi.euclideanDistance(detection.descriptor, targetDesc);
                if (dist <= 0.6 && dist < matchDistance) {
                  bestMatchUser = u;
                  matchDistance = dist;
                }
              }
            }
          }

          if (bestMatchUser && matchDistance <= 0.6) {
            const confidence = Math.round(Math.max(0, (1 - matchDistance)) * 100);

            ctx.strokeStyle = isAlive ? '#10b981' : '#38bdf8';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            const label = `Identificado: ${bestMatchUser.nome} (${confidence}%)`;
            ctx.fillStyle = isAlive ? '#10b981' : '#0284c7';
            ctx.fillRect(box.x, Math.max(0, box.y - 24), ctx.measureText(label).width + 16, 22);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillText(label, box.x + 8, Math.max(15, box.y - 8));

            // Reconhecimento validado com Prova de Vida confirmada!
            if (isAlive) {
              const matchedUser = {
                id: bestMatchUser.id,
                nome: bestMatchUser.nome,
                idAcesso: bestMatchUser.idAcesso || bestMatchUser.id_biometria_vinculada || bestMatchUser.id,
                confidence: confidence,
                distance: Number(matchDistance.toFixed(3))
              };

              handleMatchSucesso(matchedUser);
              return;
            }
          } else {
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
        }
      } catch (loopErr) {
        console.error('[LoginGatekeeper] Erro no loop de detecção facial:', loopErr);
      }

      if (isRunning) {
        bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);
      }
    };

    bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);

    return () => {
      isRunning = false;
      if (bioAnimFrameRef.current) {
        cancelAnimationFrame(bioAnimFrameRef.current);
        bioAnimFrameRef.current = null;
      }
    };
  }, [
    modoBiometricoAtivo,
    isBioCameraActive,
    modelsLoaded,
    usuarioReconhecido,
    isAuthenticating,
    faceMatcher,
    usersWithBio,
    isAlive,
    handleMatchSucesso
  ]);

  // ============================================================================
  // SUBMISSÃO PADRÃO DE E-MAIL E SENHA
  // ============================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanNome = nome.trim();

    if (isRecoveringPassword) {
      if (!cleanEmail) {
        setAlertMsg({ type: 'error', text: 'Por favor, insira o seu e-mail corporativo.' });
        return;
      }
      setIsSubmitting(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin
        });
        if (error) {
          throw error;
        }
        setAlertMsg({
          type: 'success',
          text: 'Link de recuperação de senha enviado com sucesso! Verifique seu e-mail.'
        });
        setIsRecoveringPassword(false);
      } catch (err: any) {
        console.warn('Password recovery error:', err);
        let text = err?.message || 'Erro ao enviar e-mail de recuperação.';
        const lower = text.toLowerCase();
        if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch')) {
          text = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.';
        }
        setAlertMsg({
          type: 'error',
          text
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!cleanEmail || !cleanPassword || (isSignUp && !cleanNome)) {
      setAlertMsg({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' });
      return;
    }

    if (cleanPassword.length < 6) {
      setAlertMsg({ type: 'error', text: 'A senha deve conter no mínimo 6 caracteres.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await register(cleanEmail, cleanPassword, cleanNome);
        
        const emailFormulario = cleanEmail;
        const nomeFormulario = cleanNome;
        try {
          await supabase
            .from('usuarios_permissoes')
            .upsert([
              { email: emailFormulario, nome: nomeFormulario, perfil: 'Operação', status_acesso: 'Pendente' }
            ], { onConflict: 'email' });
        } catch (upsertErr) {
          console.warn('Upsert permissions warning:', upsertErr);
        }

        setAlertMsg({ 
          type: 'success', 
          text: 'Cadastro realizado com sucesso! Aguarde a aprovação da supervisão para acessar o Hub.' 
        });
        setNome('');
        setIsSignUp(false);
      } else {
        const fullSession = await login(cleanEmail, cleanPassword);
        if (fullSession.status === 'Pendente' || fullSession.status === 'Bloqueado') {
          // Handled by App / Gatekeeper state
        }
      }
    } catch (err: any) {
      console.warn('Auth handled error:', err);
      let text = err?.message || 'Ocorreu um erro inesperado.';
      const lower = text.toLowerCase();
      if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch') || lower.includes('servidor')) {
        text = 'Não foi possível conectar ao servidor de autenticação. Verifique sua conexão com a internet ou tente novamente em instantes.';
      } else if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
        text = 'Credenciais inválidas. Verifique seu e-mail e senha.';
      } else if (lower.includes('already registered') || lower.includes('user_already_exists')) {
        text = 'Este e-mail já está cadastrado. Tente fazer login.';
      } else if (lower.includes('email not confirmed')) {
        text = 'E-mail não confirmado. Verifique sua caixa de entrada.';
      }
      setAlertMsg({ type: 'error', text });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <WarehouseLoader />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative font-sans overflow-hidden">
      {/* Top Decoration */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-600 via-[#3a2573] to-violet-600" />

      {/* Background visual glows */}
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="flex justify-center mb-6">
          <CompanyLogo height={64} />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight uppercase leading-none">
          CMPC Industrial
        </h2>
        <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          Sistemas Integrados • Gatekeeper Corporativo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <motion.div 
          layout
          className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 py-8 px-6 sm:px-10 rounded-3xl shadow-2xl space-y-6"
        >
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-violet-500" />
              <span>{isRecoveringPassword ? 'Recuperar Senha' : isSignUp ? 'Criar Novo Cadastro' : 'Autenticação Necessária'}</span>
            </h3>
          </div>

          <AnimatePresence mode="wait">
            {alertMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  alertMsg.type === 'success' 
                    ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800/50' 
                    : 'bg-rose-955/20 text-rose-450 border-rose-909/30'
                }`}
              >
                {alertMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-450 mt-0.5" />
                )}
                <span className="font-medium leading-relaxed">{alertMsg.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Nome Completo
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required={isSignUp}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: André Ramalho"
                    className="w-full text-xs p-3.5 pl-10 bg-slate-950 text-white border border-slate-800 rounded-xl focus:outline-none focus:border-violet-600 transition duration-150 placeholder:text-slate-650"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                E-mail Corporativo
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: ramalho@cmpc.com.br"
                  className="w-full text-xs p-3.5 pl-10 bg-slate-950 text-white border border-slate-800 rounded-xl focus:outline-none focus:border-violet-600 transition duration-150 placeholder:text-slate-650"
                />
              </div>
            </div>

            {!isRecoveringPassword && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Senha de Acesso
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!isRecoveringPassword}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="No mínimo 6 caracteres"
                    className="w-full text-xs p-3.5 pl-10 pr-10 bg-slate-950 text-white border border-slate-800 rounded-xl focus:outline-none focus:border-violet-600 transition duration-150 placeholder:text-slate-650 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-350 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {!isSignUp && !isRecoveringPassword && (
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveringPassword(true);
                    setAlertMsg(null);
                  }}
                  className="text-slate-400 hover:text-purple-400 text-sm transition-colors duration-150 cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-950/40 mt-6"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>
                    {isRecoveringPassword 
                      ? 'ENVIAR LINK DE RECUPERAÇÃO' 
                      : isSignUp 
                        ? 'Registrar Nova Conta' 
                        : 'Conectar ao Hub'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* ORDEM 1: BOTÃO DE LOGIN FACIAL */}
          {!isSignUp && !isRecoveringPassword && (
            <button 
              type="button"
              onClick={() => {
                setAlertMsg(null);
                setModoBiometricoAtivo(true);
              }}
              className="w-full bg-indigo-900 border border-indigo-500 hover:bg-indigo-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mt-4 cursor-pointer transition-colors shadow-lg shadow-indigo-950/40"
            >
              <ScanFace className="w-5 h-5 text-indigo-300 shrink-0" />
              <span className="text-xs uppercase tracking-wider font-extrabold">Entrar com Reconhecimento Facial</span>
            </button>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-600 text-[9px] font-bold uppercase tracking-wider">Alternar Modo</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                if (isRecoveringPassword) {
                  setIsRecoveringPassword(false);
                } else {
                  setIsSignUp(!isSignUp);
                }
                setAlertMsg(null);
              }}
              className="text-xs font-bold text-violet-400 hover:text-violet-300 hover:underline cursor-pointer"
            >
              {isRecoveringPassword 
                ? 'Voltar para o login' 
                : isSignUp 
                  ? 'Já possui uma conta? Faça Login' 
                  : 'Não tem cadastro? Crie uma conta operacional'}
            </button>
          </div>
        </motion.div>

        {/* Unique, golden, shiny developer credit */}
        <div className="mt-8 text-center flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="group relative inline-flex flex-col items-center justify-center px-8 py-3.5 rounded-2xl bg-[#1e1b10]/45 border border-[#d97706]/30 backdrop-blur-md shadow-lg shadow-amber-950/35 overflow-hidden transition-all duration-300 hover:border-amber-400/50 hover:bg-[#2a220d]/70 cursor-default min-w-[290px]"
          >
            <div className="absolute inset-0 bg-amber-400/[0.03] mix-blend-overlay pointer-events-none" />
            
            <motion.div 
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-amber-300/25 to-transparent -skew-x-12 pointer-events-none"
              animate={{
                left: ['-50%', '150%']
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 1.8
              }}
            />

            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-amber-400 animate-ping absolute scale-150 opacity-40" />
              <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
            </div>
            
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-amber-400 animate-ping absolute scale-150 opacity-40" />
              <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
            </div>

            <div className="space-y-1 z-10 text-center flex flex-col items-center">
              <span className="text-[8.5px] font-bold tracking-[0.25em] text-amber-500/70 uppercase block">
                Desenvolvido com muita dedicação por
              </span>
              <span className="text-[11.5px] font-black tracking-[0.3em] bg-gradient-to-r from-amber-400 via-yellow-100 to-amber-500 bg-clip-text text-transparent uppercase block whitespace-nowrap drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.6)]">
                André Ramalho
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* ORDEM 2 & 4: MODAL DE RECONHECIMENTO FACIAL E PROVA DE VIDA */}
      {/* ============================================================================ */}
      <AnimatePresence>
        {modoBiometricoAtivo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <ScanFace className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                      Autenticação Facial
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Visão Computacional & Prova de Vida
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopBioCamera();
                    setModoBiometricoAtivo(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Fechar e voltar para a senha"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {biometricError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{biometricError}</span>
                  </div>
                )}

                {bioCameraError && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bioCameraError}</span>
                  </div>
                )}

                {/* Webcam & Canvas Scanner */}
                <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                  <video
                    ref={bioVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <canvas
                    ref={bioCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
                  />

                  {/* Overlays / Scanning animation */}
                  {isLoadingModels || loadingUsers ? (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                      <p className="text-xs font-bold text-slate-200">
                        {isLoadingModels ? 'Carregando modelos neurais de IA...' : 'Sincronizando base biométrica...'}
                      </p>
                    </div>
                  ) : !isBioCameraActive && !bioCameraError ? (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <Camera className="w-8 h-8 text-slate-400" />
                      <button
                        type="button"
                        onClick={startBioCamera}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl tracking-wider transition-colors cursor-pointer"
                      >
                        Ativar Câmera
                      </button>
                    </div>
                  ) : null}

                  {/* Authenticating overlay */}
                  {isAuthenticating && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                      <p className="text-sm font-extrabold text-emerald-400">
                        {usuarioReconhecido?.nome ? `Bem-vindo, ${usuarioReconhecido.nome}!` : 'Autenticando sessão...'}
                      </p>
                      <p className="text-xs text-slate-400">Redirecionando para o Hub...</p>
                    </div>
                  )}

                  {/* Liveness / Yaw Badge */}
                  {isBioCameraActive && !isLoadingModels && !isAuthenticating && (
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-white/10">
                      <div className="flex items-center gap-1.5">
                        <Eye className={`w-3.5 h-3.5 ${isAlive ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span>
                          {isAlive ? 'Prova de Vida OK ✓' : 'Vire o rosto levemente para o lado'}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">
                        {facesCadastradas} faces
                      </span>
                    </div>
                  )}
                </div>

                {/* Instructions Box */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold uppercase text-[10px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Instruções de Escaneamento</span>
                  </div>
                  <p>• Mantenha o rosto centralizado em local bem iluminado.</p>
                  <p>• Movimente o rosto levemente para um dos lados para confirmação da prova de vida.</p>
                </div>
              </div>

              {/* Modal Footer / ORDEM 4: Botão Voltar para Senha */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopBioCamera();
                    setModoBiometricoAtivo(false);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Senha</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
