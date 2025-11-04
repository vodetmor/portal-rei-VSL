
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useAuth, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, RecaptchaVerifier, PhoneAuthProvider, multiFactor } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Camera, ShieldCheck, UserCircle, Upload, Link2, Phone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const profileSchema = z.object({
  displayName: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Por favor, insira sua senha atual.'),
  newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword'],
});

const phoneSchema = z.object({
    phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Formato inválido. Ex: +5511999999999'),
});

const otpSchema = z.object({
    otp: z.string().length(6, 'O código deve ter 6 dígitos.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;
type PhoneFormValues = z.infer<typeof phoneSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  
  // 2FA State
  const [mfaEnrollment, setMfaEnrollment] = useState<any>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);


  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        displayName: '',
    }
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    }
  });
  
  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' }
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' }
  });


  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
    if (user) {
      profileForm.reset({ displayName: user.displayName || '' });
      setAvatarPreview(user.photoURL || null);
      setAvatarUrlInput(user.photoURL || '');
      
      const enrolledMfa = multiFactor(user).enrolledFactors;
      setMfaEnrollment(enrolledMfa.length > 0 ? enrolledMfa[0] : null);
    }
  }, [user, userLoading, router, profileForm]);
  
  useEffect(() => {
    if (auth && !recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {},
        'expired-callback': () => {}
      });
      // Render the reCAPTCHA widget when the component mounts
      recaptchaVerifierRef.current.render();
    }
  }, [auth]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarUrlInput(''); // clear url input
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setAvatarUrlInput(url);
    setAvatarFile(null); // clear file input
    if(url.startsWith('http://') || url.startsWith('https://')) {
        setAvatarPreview(url);
    }
  }

  const uploadAvatar = useCallback(async () => {
    if (!avatarFile || !user) return null;
    
    const storage = getStorage();
    const filePath = `avatars/${user.uid}/${Date.now()}-${avatarFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, avatarFile);

    return new Promise<string>((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
          console.error("Upload failed:", error);
          toast({ variant: "destructive", title: "Erro de Upload", description: "Não foi possível enviar a imagem." });
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve);
        }
      );
    });
  }, [avatarFile, user, toast]);

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !firestore || !auth?.currentUser) return;
    setIsSavingProfile(true);
    setUploadProgress(null);

    try {
      let photoURL = user.photoURL;

      if (imageInputMode === 'upload' && avatarFile) {
        const newPhotoURL = await uploadAvatar();
        if (newPhotoURL) {
          photoURL = newPhotoURL;
        }
      } else if (imageInputMode === 'url' && avatarUrlInput) {
        photoURL = avatarUrlInput;
      }

      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
        photoURL: photoURL,
      });

      const userDocRef = doc(firestore, 'users', user.uid);
      const userData = {
        displayName: data.displayName,
        photoURL: photoURL,
      };

      setDoc(userDocRef, userData, { merge: true }).catch(err => {
          const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'update',
              requestResourceData: userData
          });
          errorEmitter.emit('permission-error', permissionError);
      });

      toast({ title: "Sucesso!", description: "Seu perfil foi atualizado." });
      setAvatarFile(null);
      setUploadProgress(null);
      
      await auth.currentUser?.reload(); 
      router.refresh();


    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o perfil." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user || !user.email) return;
    setIsSavingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      
      toast({ title: "Sucesso!", description: "Sua senha foi alterada." });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: ''});

    } catch (error: any) {
      console.error('Error updating password:', error);
      let description = "Não foi possível alterar a senha.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "A senha atual está incorreta.";
         passwordForm.setError("currentPassword", { type: "manual", message: "Senha atual incorreta."});
      }
      toast({ variant: "destructive", title: "Erro", description });
    } finally {
      setIsSavingPassword(false);
    }
  };
  
    const onSendOtp = async (data: PhoneFormValues) => {
        if (!user || !recaptchaVerifierRef.current) return;
        try {
            const session = await multiFactor(user).getSession();
            const phoneInfoOptions = {
                phoneNumber: data.phoneNumber,
                session: session
            };
            const phoneAuthProvider = new PhoneAuthProvider(auth);
            const verId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifierRef.current);
            setVerificationId(verId);
            toast({ title: "Código Enviado!", description: "Verifique seu celular para o código de 6 dígitos." });
        } catch (error) {
            console.error("Error sending OTP:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível enviar o código. Verifique o número e tente novamente." });
        }
    };
    
    const onVerifyOtp = async (data: OtpFormValues) => {
        if (!verificationId || !user) return;
        try {
            const cred = PhoneAuthProvider.credential(verificationId, data.otp);
            const multiFactorAssertion = PhoneAuthProvider.credential(verificationId, data.otp);
            await multiFactor(user).enroll(multiFactorAssertion);
            
            const enrolledMfa = multiFactor(user).enrolledFactors;
            setMfaEnrollment(enrolledMfa.length > 0 ? enrolledMfa[0] : null);
            setVerificationId(null);
            otpForm.reset();
            phoneForm.reset();

            toast({ title: "Sucesso!", description: "A verificação em duas etapas está ativa." });

        } catch (error) {
            console.error("Error verifying OTP:", error);
            toast({ variant: "destructive", title: "Erro", description: "Código inválido ou expirado." });
        }
    };
    
    const unenrollMfa = async () => {
        if(!user || !mfaEnrollment) return;
        try {
            await multiFactor(user).unenroll(mfaEnrollment);
            setMfaEnrollment(null);
            toast({ title: "2FA Desativado", description: "A verificação em duas etapas foi removida." });
        } catch (error) {
            console.error("Error unenrolling MFA:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível desativar a verificação em duas etapas." });
        }
    }

  
  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:px-8">
      <div id="recaptcha-container"></div>
      <div className="mb-8 pt-20">
        <h1 className="text-3xl font-bold text-white">Configurações da Conta</h1>
        <p className="text-muted-foreground">Gerencie suas informações de perfil e segurança.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">
            <UserCircle className="mr-2 h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Segurança
          </TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                <CardHeader>
                  <CardTitle>Informações Públicas</CardTitle>
                  <CardDescription>Essas informações podem ser exibidas publicamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                        <div className="relative group">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={avatarPreview || undefined} alt={user.displayName || 'User'} />
                            <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        </div>
                        <div className="w-full flex-1">
                            <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'upload' | 'url')} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4"/>Enviar</TabsTrigger>
                                    <TabsTrigger value="url"><Link2 className="mr-2 h-4 w-4"/>URL</TabsTrigger>
                                </TabsList>
                                <TabsContent value="upload" className="mt-4">
                                     <label htmlFor="avatar-upload" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-white border border-dashed rounded-md p-3 justify-center bg-background/50">
                                        <Camera className="h-4 w-4" />
                                        <span>{avatarFile ? avatarFile.name : 'Clique para selecionar'}</span>
                                    </label>
                                    <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                                    {uploadProgress !== null && <Progress value={uploadProgress} className="mt-2 h-2" />}
                                </TabsContent>
                                <TabsContent value="url" className="mt-4">
                                    <Input 
                                        type="text" 
                                        placeholder="https://exemplo.com/sua-imagem.png"
                                        value={avatarUrlInput}
                                        onChange={handleAvatarUrlChange}
                                        className="bg-background/50"
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                  <FormField
                    control={profileForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome de Exibição</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu nome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
            <Card>
                <CardHeader>
                  <CardTitle>Verificação em Duas Etapas (2FA)</CardTitle>
                  <CardDescription>Adicione uma camada extra de segurança à sua conta usando SMS.</CardDescription>
                </CardHeader>
                 <CardContent>
                    {mfaEnrollment ? (
                        <div className="space-y-4">
                             <Alert variant="default" className="border-green-500/50 bg-green-500/10">
                                <ShieldCheck className="h-4 w-4 text-green-500" />
                                <AlertTitle className="text-green-400">2FA Ativado</AlertTitle>
                                <AlertDescription className="text-muted-foreground">
                                    Sua conta está protegida com verificação via SMS para o número: {mfaEnrollment.displayName}.
                                </AlertDescription>
                            </Alert>
                             <Button variant="destructive" onClick={unenrollMfa}>Desativar 2FA</Button>
                        </div>
                    ) : verificationId ? (
                        <Form {...otpForm}>
                            <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4">
                                <FormField
                                    control={otpForm.control}
                                    name="otp"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Código de Verificação</FormLabel>
                                        <FormControl>
                                            <Input placeholder="123456" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit">Verificar Código</Button>
                            </form>
                        </Form>
                    ) : (
                         <Form {...phoneForm}>
                            <form onSubmit={phoneForm.handleSubmit(onSendOtp)} className="space-y-4">
                                <FormField
                                    control={phoneForm.control}
                                    name="phoneNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Número de Celular</FormLabel>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl>
                                                    <Input placeholder="+5511999999999" {...field} className="pl-9"/>
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit">Enviar Código</Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>

          <Card>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                <CardHeader>
                  <CardTitle>Alterar Senha</CardTitle>
                  <CardDescription>Use uma senha forte para manter sua conta segura.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha Atual</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Senha</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Nova Senha</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit" disabled={isSavingPassword}>
                    {isSavingPassword ? 'Salvando...' : 'Alterar Senha'}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    