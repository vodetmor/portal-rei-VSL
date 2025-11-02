'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
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
import { Camera, ShieldCheck, UserCircle } from 'lucide-react';

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

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

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
  
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
    if (user) {
      profileForm.reset({ displayName: user.displayName || '' });
    }
  }, [user, userLoading, router, profileForm]);
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
    if (!user || !firestore || !auth) return;
    setIsSavingProfile(true);
    setUploadProgress(null);

    try {
      let photoURL = user.photoURL;

      if (avatarFile) {
        const newPhotoURL = await uploadAvatar();
        if (newPhotoURL) {
          photoURL = newPhotoURL;
        }
      }

      await updateProfile(user, {
        displayName: data.displayName,
        photoURL: photoURL,
      });

      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        displayName: data.displayName,
        photoURL: photoURL,
      }, { merge: true });

      toast({ title: "Sucesso!", description: "Seu perfil foi atualizado." });
      setAvatarFile(null);
      setAvatarPreview(null);
      setUploadProgress(null);
      // Force a reload of the user object to see changes
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
      if (error.code === 'auth/wrong-password') {
        description = "A senha atual está incorreta.";
         passwordForm.setError("currentPassword", { type: "manual", message: "Senha atual incorreta."});
      }
      toast({ variant: "destructive", title: "Erro", description });
    } finally {
      setIsSavingPassword(false);
    }
  };
  
  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 pt-24 md:px-8">
      <div className="mb-8">
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
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                       <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarPreview || user.photoURL || undefined} alt={user.displayName || 'User'} />
                        <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                          <Camera className="h-8 w-8 text-white" />
                      </label>
                      <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{user.displayName}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {uploadProgress !== null && <Progress value={uploadProgress} className="mt-2 h-2" />}
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
        <TabsContent value="security">
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
