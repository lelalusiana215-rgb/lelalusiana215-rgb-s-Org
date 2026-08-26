import * as React from 'react';
const { useState, useEffect, useRef } = React;
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs, getDocFromServer } from 'firebase/firestore';
import { db, auth, signInWithGoogle, signInWithGithub } from './firebase';
import { Student, HabitRecord } from './types';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  CheckCircle, 
  Download, 
  Layout, 
  Lock, 
  Settings, 
  CreditCard, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  PlayCircle,
  FileText,
  Users,
  ShieldCheck,
  Zap,
  BookOpen,
  Mail,
  Info,
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.toString();
      let errorDetail = null;
      
      try {
        if (errorMessage && errorMessage.startsWith('Error: {')) {
          const jsonStr = errorMessage.replace('Error: ', '');
          errorDetail = JSON.parse(jsonStr);
          errorMessage = errorDetail.error || errorMessage;
        } else if (errorMessage && errorMessage.startsWith('{')) {
          errorDetail = JSON.parse(errorMessage);
          errorMessage = errorDetail.error || errorMessage;
        }
      } catch (e) {
        // Not JSON, keep original
      }

      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border-2 border-red-100">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-700 mb-4">Terjadi Kesalahan</h1>
            <p className="text-gray-600 mb-6">Aplikasi mengalami kendala teknis. Silakan coba muat ulang halaman.</p>
            <div className="bg-red-50 p-4 rounded-xl text-left text-xs font-mono text-red-800 mb-6 overflow-auto max-h-60">
              <p className="font-bold mb-2">{errorMessage}</p>
              {errorDetail && (
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(errorDetail, null, 2)}
                </pre>
              )}
            </div>
            <button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600 text-white py-3 px-8 rounded-xl font-bold">
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Teacher password auth
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false); // Firebase auth
  const [isDemo, setIsDemo] = useState(false);
  const [schoolEmail, setSchoolEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [approvedSchoolsList, setApprovedSchoolsList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const OWNER_EMAIL = 'lelalusiana215@gmail.com'.toLowerCase();
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Debug State
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-49), `[${time}] ${msg}`]);
    console.log(`[AppLog] ${msg}`);
  };

  const handleTitleClick = () => {
    setClickCount(prev => {
      if (prev + 1 >= 5) {
        setShowDebug(!showDebug);
        return 0;
      }
      return prev + 1;
    });
  };

  // Report Configuration
  const [schoolName, setSchoolName] = useState('NAMA SEKOLAH ANDA');
  const [schoolAddress, setSchoolAddress] = useState('Alamat Lengkap Sekolah Anda');
  const [principalName, setPrincipalName] = useState('Nama Kepala Sekolah, S.Pd.');
  const [principalNip, setPrincipalNip] = useState('');
  const [teacherName, setTeacherName] = useState('Nama Guru Kelas, S.Pd.');
  const [teacherNip, setTeacherNip] = useState('');
  const [showReportPreview, setShowReportPreview] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [habitRecords, setHabitRecords] = useState<HabitRecord[]>([]);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isErrorToast, setIsErrorToast] = useState(false);

  // Form State
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Report State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState(new Date().getMonth() < 6 ? 2 : 1);
  const [selectedSemesterYear, setSelectedSemesterYear] = useState(new Date().getFullYear());
  const [selectedReportClass, setSelectedReportClass] = useState('');

  const handleEnterDemo = () => {
    setIsDemo(true);
    setIsFirebaseAuthenticated(true);
    setIsApproved(true);
    setIsSchoolAdmin(true);
    setSchoolEmail('demo@sekolah.id');
    setCurrentPage('home');
    setStudents([
      { id: '1', student_name: 'Budi Santoso', class: '4A', schoolEmail: 'demo@sekolah.id' },
      { id: '2', student_name: 'Siti Aminah', class: '4A', schoolEmail: 'demo@sekolah.id' },
      { id: '3', student_name: 'Andi Pratama', class: '4B', schoolEmail: 'demo@sekolah.id' }
    ]);
    displayToast("Mode Demo Aktif: Anda dapat mencoba fitur aplikasi dengan data contoh.");
  };


  const renderLandingPage = () => (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-purple-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">S</div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-700">SIMO-G7KAIH</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-purple-700 font-medium transition-colors">Fitur</a>
              <button 
                onClick={() => setCurrentPage('login')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl font-bold transition-all transform hover:scale-105 shadow-md flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Member Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-32 pb-20 px-4 bg-gradient-to-b from-purple-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-bold mb-6">
              #1 Aplikasi Monitoring Kebiasaan Siswa
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight">
              Bangun <span className="text-purple-600">Kebiasaan Baik</span> <br className="hidden md:block" /> Setiap Hari dengan SIMO
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Solusi digital untuk memantau 7 Kebiasaan Anak Indonesia Hebat secara real-time. Akses terbatas khusus untuk sekolah terdaftar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => setCurrentPage('login')}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-purple-200 transform hover:-translate-y-1"
              >
                Member Login <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={handleEnterDemo}
                className="w-full sm:w-auto bg-white border-2 border-purple-200 hover:border-purple-600 text-purple-700 px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all"
              >
                Coba Demo Gratis <PlayCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mt-12">
              <a 
                href="http://lynk.id/bugurulela" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold group"
              >
                <CreditCard className="w-5 h-5" />
                Beli Lisensi Penuh di Lynk.id <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Stats/Social Proof */}
      <section className="py-12 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
           <div className="flex flex-col items-center">
             <span className="text-3xl font-bold text-gray-900">100+</span>
             <span className="text-gray-500 font-medium">Sekolah Aktif</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-3xl font-bold text-gray-900">5k+</span>
             <span className="text-gray-500 font-medium">Siswa Terdaftar</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-3xl font-bold text-gray-900">50k+</span>
             <span className="text-gray-500 font-medium">Laporan Dibuat</span>
           </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Fitur Unggulan</h2>
            <p className="text-gray-600">Didesain khusus untuk kebutuhan guru masa kini.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Layout className="w-8 h-8 text-purple-600" />,
                title: "Dashboard Interaktif",
                desc: "Visualisasi data real-time dengan grafik yang mudah dipahami untuk memantau progres siswa setiap hari."
              },
              {
                icon: <FileText className="w-8 h-8 text-blue-600" />,
                title: "Laporan Otomatis",
                desc: "Cetak laporan harian, bulanan, hingga semester dalam format Excel atau PDF hanya dengan satu klik."
              },
              {
                icon: <Users className="w-8 h-8 text-green-600" />,
                title: "Manajemen Terintegrasi",
                desc: "Kelola data siswa dan guru pendamping dengan sistem yang aman dan terisolasi antar sekolah."
              },
              {
                icon: <Zap className="w-8 h-8 text-yellow-600" />,
                title: "Input Cepat (Shared Form)",
                desc: "Bagikan link pengisian form kepada siswa melalui WhatsApp tanpa mewajibkan siswa untuk login."
              },
              {
                icon: <ShieldCheck className="w-8 h-8 text-red-600" />,
                title: "Keamanan Data",
                desc: "Data tersimpan aman di infrastruktur Google Cloud (Firebase) dengan otorisasi domain berlapis."
              }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-3xl border border-gray-100 bg-gray-50 hover:border-purple-200 transition-all hover:bg-white hover:shadow-xl group">
                <div className="mb-6 bg-white w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Siap Memulai Perubahan?</h2>
          <p className="text-gray-600 mb-10 text-lg">Gunakan SIMO-G7KAIH hari ini. Pastikan Anda telah memiliki lisensi aktif untuk mengakses fitur penuh.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="http://lynk.id/bugurulela" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold text-xl shadow-xl shadow-indigo-200 transition-all transform hover:scale-105"
            >
              Beli Lisensi
            </a>
            <button 
              onClick={() => setCurrentPage('login')}
              className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-800 px-10 py-4 rounded-2xl font-bold text-xl transition-all"
            >
              Member Login
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white text-center px-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center font-bold">S</div>
          <span className="text-xl font-bold">SIMO-G7KAIH</span>
        </div>
        <p className="text-gray-400 text-sm mb-8">Dibuat dengan ❤️ untuk Pendidikan Indonesia oleh Bu Guru Lela</p>
        <div className="flex justify-center gap-6 mb-8 text-gray-400">
          <Mail className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
          <Info className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
        </div>
        <div className="text-gray-500 text-xs">
          &copy; {new Date().getFullYear()} SIMO-G7KAIH. Hak Cipta Dilindungi.
        </div>
      </footer>
    </div>
  );

  const renderLoginPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full relative overflow-hidden">
        <button 
          onClick={() => setCurrentPage('landing')}
          className="absolute top-4 left-4 text-gray-400 hover:text-purple-600 p-2 rounded-full hover:bg-gray-50 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="text-center mt-4">
          <div className="w-16 h-16 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-4">S</div>
          <h1 className="text-3xl font-bold text-purple-700 mb-2">Member Login</h1>
          <p className="text-gray-500 mb-8 font-medium italic">Khusus Pengguna Lisensi Resmi SIMO-G7KAIH</p>
          
          <div className="space-y-4">
            <button 
              onClick={signInWithGoogle}
              className="w-full py-4 border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 font-bold text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-all group"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Masuk dengan Google
            </button>

            <button 
              onClick={signInWithGithub}
              className="w-full py-4 border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 font-bold text-gray-700 hover:border-gray-800 hover:bg-gray-50 transition-all group"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              Masuk dengan GitHub
            </button>
          </div>
          
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">Atau coba sekarang</span></div>
          </div>
          
          <button 
            onClick={handleEnterDemo}
            className="w-full py-4 bg-purple-50 text-purple-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-purple-100 transition-all border border-purple-100"
          >
            <PlayCircle className="w-5 h-5" /> Masuk Akun Demo
          </button>
          
          <p className="mt-8 text-xs text-gray-400">
            Dengan masuk, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami.
          </p>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const testConnection = async () => {
      addLog("Testing Firebase connection...");
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        addLog("Firebase connection test complete (permission denied is expected if not exists)");
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          addLog("CRITICAL: Firebase client is offline!");
          displayToast("Kesalahan konfigurasi Firebase. Hubungi admin.", true);
        } else {
          addLog(`Firebase connection test result: ${error.message}`);
        }
      }
    };
    testConnection();
    
    // Check if URL has ?view=form
    const params = new URLSearchParams(window.location.search);
    const isShared = params.get('view') === 'form';
    addLog(`Initializing app. Shared mode: ${isShared}`);
    
    if (isShared) {
      setIsSharedMode(true);
      setCurrentPage('form');
      const schoolParam = params.get('school');
      if (schoolParam) {
        addLog(`School email from URL: ${schoolParam}`);
        setSchoolEmail(schoolParam);
      }
    }

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      addLog(`Auth state changed: ${user ? user.email : "No user"}`);
      if (isDemo) return; // Don't let real auth override demo mode if active
      
      try {
        if (user) {
          setIsFirebaseAuthenticated(true);
          const userEmail = (user.email || '').toLowerCase();
          
          if (isShared) {
            addLog("Shared mode: skipping approval check");
            setCheckingApproval(false);
          } else {
            setCurrentPage('home'); // Go to home if logged in
            if (userEmail === OWNER_EMAIL) {
              addLog("Owner detected");
              setIsOwner(true);
              setIsSchoolAdmin(true);
              setIsApproved(true);
              setSchoolEmail(userEmail);
              setCheckingApproval(false);
            } else {
              setIsOwner(false);
              addLog(`Checking approval for: ${userEmail}`);
              const docRef = doc(db, 'approvedSchools', userEmail);
              try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  addLog("User approved as school admin");
                  setIsSchoolAdmin(true);
                  setIsApproved(true);
                  setSchoolEmail(userEmail);
                } else {
                  addLog("Not school admin, checking teacher status");
                  const teacherDocRef = doc(db, 'teachers', userEmail);
                  const teacherDocSnap = await getDoc(teacherDocRef);
                  if (teacherDocSnap.exists()) {
                    addLog("User approved as teacher");
                    setIsSchoolAdmin(false);
                    setIsApproved(true);
                    setSchoolEmail(teacherDocSnap.data().schoolEmail);
                  } else {
                    addLog("User not found in approved lists");
                    setIsSchoolAdmin(false);
                    setIsApproved(false);
                  }
                }
              } catch (error) {
                addLog(`Error fetching approval docs: ${error instanceof Error ? error.message : String(error)}`);
                handleFirestoreError(error, OperationType.GET, 'approvedSchools/' + userEmail);
              }
              setCheckingApproval(false);
            }
          }
        } else {
          addLog("User not authenticated");
          setIsFirebaseAuthenticated(false);
          setIsOwner(false);
          setIsSchoolAdmin(false);
          setIsApproved(false);
          if (!isShared) {
            setSchoolEmail('');
          }
          setCheckingApproval(false);
        }
      } catch (error) {
        addLog(`Auth state change error: ${error instanceof Error ? error.message : String(error)}`);
        setCheckingApproval(false);
        displayToast("Gagal memverifikasi akses. Silakan coba muat ulang halaman.", true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (schoolEmail && (isSharedMode || (isFirebaseAuthenticated && isApproved))) {
      const studentsRef = collection(db, 'students');
      const qStudents = query(studentsRef, where('schoolEmail', '==', schoolEmail));
      const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
        const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudents(studentsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'students');
      });

      const habitsRef = collection(db, 'habitRecords');
      const qHabits = query(habitsRef, where('schoolEmail', '==', schoolEmail));
      const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
        const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitRecord));
        setHabitRecords(habitsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'habitRecords');
      });

      return () => {
        unsubscribeStudents();
        unsubscribeHabits();
      };
    }
  }, [isFirebaseAuthenticated, schoolEmail, isApproved, isSharedMode]);

  useEffect(() => {
    if (isOwner) {
      const unsubscribe = onSnapshot(collection(db, 'approvedSchools'), (snapshot) => {
        setApprovedSchoolsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'approvedSchools');
      });
      return () => unsubscribe();
    }
  }, [isOwner]);

  useEffect(() => {
    if (isSchoolAdmin && schoolEmail) {
      const qTeachers = query(collection(db, 'teachers'), where('schoolEmail', '==', schoolEmail));
      const unsubscribe = onSnapshot(qTeachers, (snapshot) => {
        setTeachersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'teachers');
      });
      return () => unsubscribe();
    }
  }, [isSchoolAdmin, schoolEmail]);

  const displayToast = (message: string, isError = false) => {
    setToastMessage(message);
    setIsErrorToast(isError);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?view=form&school=${schoolEmail}`;
    navigator.clipboard.writeText(link).then(() => {
      displayToast('✅ Link formulir berhasil disalin!');
    }).catch(() => {
      displayToast('Gagal menyalin link.', true);
    });
  };

  const handleAddApprovedSchool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('school-email') as string;
    if (email.trim()) {
      try {
        await setDoc(doc(db, 'approvedSchools', email.trim().toLowerCase()), {
          email: email.trim().toLowerCase(),
          addedAt: new Date().toISOString()
        });
        displayToast('✅ Email sekolah berhasil disetujui!');
        (e.target as HTMLFormElement).reset();
      } catch (error) {
        displayToast('Gagal menyetujui email.', true);
      }
    }
  };

  const handleRemoveApprovedSchool = async (email: string) => {
    if (window.confirm(`Hapus akses untuk ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'approvedSchools', email));
        displayToast('✅ Akses sekolah dicabut!');
      } catch (error) {
        displayToast('Gagal mencabut akses.', true);
      }
    }
  };

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('teacher-email') as string;
    const name = formData.get('teacher-name') as string;
    
    if (email.trim() && name.trim()) {
      try {
        await setDoc(doc(db, 'teachers', email.trim().toLowerCase()), {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          schoolEmail: schoolEmail,
          addedAt: new Date().toISOString()
        });
        displayToast('✅ Akun guru berhasil ditambahkan!');
        (e.target as HTMLFormElement).reset();
      } catch (error) {
        displayToast('Gagal menambahkan guru.', true);
      }
    }
  };

  const handleRemoveTeacher = async (email: string) => {
    if (window.confirm(`Hapus akses guru untuk ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'teachers', email));
        displayToast('✅ Akses guru dicabut!');
      } catch (error) {
        displayToast('Gagal mencabut akses guru.', true);
      }
    }
  };


  const handlePasswordSubmit = () => {
    if (passwordInput === 'guru123') {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPasswordError(false);
      setPasswordInput('');
      setCurrentPage(passwordTarget);
    } else {
      setPasswordError(true);
    }
  };

  const openProtectedPage = (page: string) => {
    if (isAuthenticated) {
      setCurrentPage(page);
    } else {
      setPasswordTarget(page);
      setShowPasswordModal(true);
    }
  };

  const calculateScore = (data: any) => {
    let score = 0;
    if (data.wake_time) {
      const time = data.wake_time.split(':');
      const minutes = parseInt(time[0]) * 60 + parseInt(time[1]);
      score += minutes <= 330 ? 100 : 50;
    }
    const prayerCount = [
      data.prayer_subuh, data.prayer_dhuhur, data.prayer_ashar,
      data.prayer_maghrib, data.prayer_isya, data.dta
    ].filter(Boolean).length;
    score += (prayerCount / 6) * 100;
    score += data.exercise ? 100 : 0;
    score += data.healthy_food ? 100 : 0;
    if (data.study_duration) {
      const duration = parseInt(data.study_duration);
      score += Math.min(100, (duration / 120) * 100);
    }
    score += data.social_activity ? 100 : 0;
    if (data.sleep_time) {
      const time = data.sleep_time.split(':');
      const minutes = parseInt(time[0]) * 60 + parseInt(time[1]);
      if (minutes <= 1260) score += 100;
      else if (minutes <= 1290) score += 70;
      else score += 40;
    }
    return Math.round(score / 7);
  };

  const getCategory = (score: number) => {
    if (score >= 71) return 'Sudah Terbiasa';
    if (score >= 41) return 'Mulai Terbiasa';
    return 'Belum Terbiasa';
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const isDuplicate = habitRecords.some(item => 
      item.student_name === selectedStudent && 
      item.class === selectedClass && 
      item.date === selectedDate
    );

    if (isDuplicate) {
      displayToast(`${selectedStudent} sudah mengisi form untuk tanggal ${selectedDate}!`, true);
      return;
    }

    const data = {
      student_name: selectedStudent,
      class: selectedClass,
      date: selectedDate,
      wake_time: formData.get('wake-time') as string,
      prayer_subuh: formData.get('prayer-subuh') === 'on',
      prayer_dhuhur: formData.get('prayer-dhuhur') === 'on',
      prayer_ashar: formData.get('prayer-ashar') === 'on',
      prayer_maghrib: formData.get('prayer-maghrib') === 'on',
      prayer_isya: formData.get('prayer-isya') === 'on',
      dta: formData.get('dta') === 'on',
      exercise: formData.get('exercise') === 'yes',
      exercise_type: formData.get('exercise-type') as string,
      healthy_food: formData.get('food') === 'yes',
      food_menu: formData.get('food-menu') as string,
      study_duration: formData.get('study-duration') as string,
      social_activity: formData.get('social-activity') as string,
      sleep_time: formData.get('sleep-time') as string,
    };

    const score = calculateScore(data);
    const finalData = { ...data, total_score: score, category: getCategory(score), schoolEmail };

    try {
      await addDoc(collection(db, 'habitRecords'), finalData);
      displayToast('✅ Data berhasil disimpan!');
      (e.target as HTMLFormElement).reset();
      setSelectedClass('');
      setSelectedStudent('');
      if (isSharedMode) {
        setFormSubmitted(true);
      }
    } catch (error) {
      displayToast('Gagal menyimpan data.', true);
      console.error(error);
    }
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentName = formData.get('new-student-name') as string;
    const studentClass = formData.get('new-student-class') as string;

    const isDuplicate = students.some(s => s.student_name.toLowerCase() === studentName.toLowerCase() && s.class === studentClass);
    if (isDuplicate) {
      displayToast(`Siswa "${studentName}" sudah ada di ${studentClass}!`, true);
      return;
    }

    try {
      await addDoc(collection(db, 'students'), { student_name: studentName, class: studentClass, schoolEmail });
      displayToast('✅ Siswa berhasil ditambahkan!');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      displayToast('Gagal menambahkan siswa.', true);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus siswa "${student.student_name}"? Data rekap harian siswa ini tidak akan terhapus secara otomatis, namun siswa tidak akan muncul lagi di daftar isian.`)) {
      try {
        await deleteDoc(doc(db, 'students', student.id));
        displayToast('✅ Siswa berhasil dihapus!');
      } catch (error) {
        displayToast('Gagal menghapus siswa.', true);
      }
    }
  };

  const handleDeleteAllStudentData = async (student: Student) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus SELURUH data rekap harian untuk "${student.student_name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        const q = query(
          collection(db, 'habitRecords'),
          where('schoolEmail', '==', schoolEmail),
          where('student_name', '==', student.student_name),
          where('class', '==', student.class)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          displayToast('Siswa ini belum memiliki data rekap.', true);
          return;
        }
        
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        displayToast(`✅ Seluruh data rekap ${student.student_name} berhasil dihapus!`);
      } catch (error) {
        displayToast('Gagal menghapus data rekap.', true);
      }
    }
  };

  const handleDeleteHabitRecord = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data rekap ini?')) {
      try {
        await deleteDoc(doc(db, 'habitRecords', id));
        displayToast('✅ Data rekap berhasil dihapus!');
      } catch (error) {
        displayToast('Gagal menghapus data rekap.', true);
      }
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        let successCount = 0;
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row.length >= 2) {
            const studentClass = String(row[0]).trim();
            const studentName = String(row[1]).trim();
            
            if (studentClass && studentName && !students.some(s => s.student_name === studentName && s.class === studentClass)) {
              await addDoc(collection(db, 'students'), { student_name: studentName, class: studentClass, schoolEmail });
              successCount++;
            }
          }
        }
        displayToast(`✅ Berhasil mengimpor ${successCount} siswa!`);
      } catch (error) {
        displayToast('Gagal mengimpor file Excel.', true);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      ['Kelas', 'Nama Siswa'],
      ['Kelas 1', 'Budi Santoso'],
      ['Kelas 2', 'Siti Aminah'],
      ['Kelas 3', 'Andi Darmawan']
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
  };

  const handleLogout = () => {
    setIsDemo(false);
    auth.signOut();
    setCurrentPage('landing');
  };

  const renderHomePage = () => (
    <div className="bg-white rounded-3xl shadow-2xl p-8 relative overflow-hidden">
      {isDemo && (
        <div className="bg-yellow-400 text-yellow-900 text-[10px] font-bold py-1 px-12 absolute top-4 -right-10 rotate-45 shadow-sm z-10">
          DEMO MODE
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl flex items-center gap-2">
          {isDemo ? <ShieldCheck className="w-4 h-4 text-yellow-600" /> : <ShieldCheck className="w-4 h-4 text-green-600" />}
          {isDemo ? "Akun Demo Terbatas" : schoolEmail}
        </div>
        <div className="flex gap-2">
          {isAuthenticated && (
            <button onClick={() => setIsAuthenticated(false)} className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-xl font-bold text-sm flex items-center gap-2">
              <Lock className="w-4 h-4" /> Kunci Mode Guru
            </button>
          )}
          <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
            <LogOut className="w-4 h-4" /> {isDemo ? "Keluar Demo" : "Keluar Akun"}
          </button>
        </div>
      </div>
      <div className="text-center mb-8">
        <h1 onClick={handleTitleClick} className="text-4xl font-bold text-purple-700 mb-2 cursor-pointer select-none">SIMO-G7KAIH</h1>
        <p className="text-xl text-gray-600">Mari Membangun Kebiasaan Baik Setiap Hari!</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <button onClick={() => setCurrentPage('form')} className="btn-menu bg-green-500 hover:bg-green-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg w-full">
            🎯 Form Isian Siswa
          </button>
          <button onClick={handleCopyLink} className="bg-green-100 hover:bg-green-200 text-green-800 py-2 px-4 rounded-xl font-bold shadow-sm text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Bagikan Link Form
          </button>
        </div>
        <button onClick={() => openProtectedPage('daily')} className="btn-menu bg-blue-500 hover:bg-blue-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg">
          📊 Rekap Harian 🔒
        </button>
        <button onClick={() => openProtectedPage('monthly')} className="btn-menu bg-yellow-500 hover:bg-yellow-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg">
          📈 Rekap Bulanan 🔒
        </button>
        <button onClick={() => openProtectedPage('semester')} className="btn-menu bg-purple-500 hover:bg-purple-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg">
          🏆 Rekap Semester 🔒
        </button>
        <button onClick={() => openProtectedPage('student-management')} className="btn-menu bg-red-500 hover:bg-red-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg col-span-1 md:col-span-2">
          👥 Kelola Data Siswa 🔒
        </button>
        {isSchoolAdmin && (
          <button onClick={() => openProtectedPage('teacher-management')} className="btn-menu bg-teal-500 hover:bg-teal-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg col-span-1 md:col-span-2 mt-2">
            👨‍🏫 Kelola Data Guru 🔒
          </button>
        )}
        {isOwner && (
          <button onClick={() => setCurrentPage('admin')} className="btn-menu bg-indigo-500 hover:bg-indigo-600 text-white py-6 px-8 rounded-2xl text-xl font-bold shadow-lg col-span-1 md:col-span-2 mt-2">
            👑 Kelola Akses Sekolah
          </button>
        )}
      </div>
    </div>
  );

  const renderFormPage = () => {
    if (formSubmitted && isSharedMode) {
      return (
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-green-600 mb-4">Terima Kasih!</h2>
          <p className="text-xl text-gray-600 mb-8">Data kebiasaan harian berhasil disimpan.</p>
          <button onClick={() => setFormSubmitted(false)} className="bg-purple-500 hover:bg-purple-600 text-white py-3 px-8 rounded-xl font-bold">
            Isi Form Lagi
          </button>
        </div>
      );
    }

    const classStudents = students.filter(s => s.class === selectedClass).sort((a,b) => a.student_name.localeCompare(b.student_name));
    const submittedOnDate = habitRecords.filter(item => item.date === selectedDate && item.class === selectedClass).map(item => item.student_name);

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        {!isSharedMode && (
          <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">
            ← Kembali ke Beranda
          </button>
        )}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-purple-700">Form Isian Siswa</h2>
        </div>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Data Siswa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Pilih Kelas:</label>
                <select value={selectedClass} onChange={(e) => {setSelectedClass(e.target.value); setSelectedStudent('');}} required className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none">
                  <option value="">-- Pilih Kelas --</option>
                  {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Nama Siswa:</label>
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} required disabled={!selectedClass} className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none">
                  <option value="">-- Pilih nama siswa --</option>
                  {classStudents.map(s => (
                    <option key={s.id} value={s.student_name} disabled={submittedOnDate.includes(s.student_name)}>
                      {s.student_name} {submittedOnDate.includes(s.student_name) ? '✓ (Sudah mengisi)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Tanggal:</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none" />
              </div>
            </div>
          </div>
          
          <div className="card-habit bg-yellow-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">⏰</span><h3 className="text-xl font-bold">1. Bangun Pagi</h3></div>
            <select name="wake-time" className="w-full p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none">
              <option value="">Pilih waktu bangun</option>
              {['04:00','04:15','04:30','04:45','05:00','05:15','05:30','05:45','06:00'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="card-habit bg-green-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">🕌</span><h3 className="text-xl font-bold">2. Beribadah</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['subuh', 'dhuhur', 'ashar', 'maghrib', 'isya'].map(p => (
                <label key={p} className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" name={`prayer-${p}`} className="w-5 h-5" /><span>Shalat {p.charAt(0).toUpperCase() + p.slice(1)}</span>
                </label>
              ))}
              <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="dta" className="w-5 h-5" /><span>Pengajian DTA</span></label>
            </div>
          </div>

          <div className="card-habit bg-blue-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">⚽</span><h3 className="text-xl font-bold">3. Olahraga</h3></div>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="exercise" value="yes" className="w-5 h-5" /><span>Ya</span></label>
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="exercise" value="no" className="w-5 h-5" defaultChecked /><span>Tidak</span></label>
            </div>
            <input type="text" name="exercise-type" placeholder="Jenis olahraga" className="w-full p-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:outline-none" />
          </div>

          <div className="card-habit bg-orange-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">🥗</span><h3 className="text-xl font-bold">4. Makan Bergizi</h3></div>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="food" value="yes" className="w-5 h-5" /><span>Ya</span></label>
              <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="food" value="no" className="w-5 h-5" defaultChecked /><span>Tidak</span></label>
            </div>
            <input type="text" name="food-menu" placeholder="Menu makanan" className="w-full p-3 border-2 border-orange-300 rounded-xl focus:border-orange-500 focus:outline-none" />
          </div>

          <div className="card-habit bg-purple-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">📚</span><h3 className="text-xl font-bold">5. Gemar Belajar</h3></div>
            <select name="study-duration" className="w-full p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none">
              <option value="">Pilih lama belajar</option>
              {['0','15','30','45','60','75','90','105','120'].map(t => <option key={t} value={t}>{t} menit</option>)}
            </select>
          </div>

          <div className="card-habit bg-pink-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">🤝</span><h3 className="text-xl font-bold">6. Bermasyarakat</h3></div>
            <textarea name="social-activity" placeholder="Tuliskan kegiatan bermasyarakat yang kamu lakukan hari ini." className="w-full p-3 border-2 border-pink-300 rounded-xl focus:border-pink-500 focus:outline-none" rows={3}></textarea>
          </div>

          <div className="card-habit bg-indigo-100 p-6 rounded-2xl shadow-md">
            <div className="flex items-center mb-4"><span className="text-4xl mr-3">😴</span><h3 className="text-xl font-bold">7. Tidur Cepat</h3></div>
            <select name="sleep-time" className="w-full p-3 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:outline-none">
              <option value="">Pilih waktu tidur</option>
              {['19:30','20:00','20:30','21:00','21:30','22:00'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex gap-4 justify-center">
            <button type="submit" className="bg-green-500 hover:bg-green-600 text-white py-4 px-12 rounded-xl text-xl font-bold shadow-lg">💾 Simpan Data</button>
          </div>
        </form>
      </div>
    );
  };

  const renderStudentManagementPage = () => {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCurrentPage('home')} className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
        </div>
        <h2 className="text-3xl font-bold text-center text-red-700 mb-6">👥 Kelola Data Siswa</h2>
        
        <div className="bg-gradient-to-r from-red-100 to-pink-100 p-6 rounded-2xl mb-6">
          <h3 className="text-xl font-bold mb-4">➕ Tambah Siswa Baru</h3>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Kelas:</label>
                <select name="new-student-class" required className="w-full p-3 border-2 border-red-300 rounded-xl focus:border-red-500 focus:outline-none">
                  <option value="">-- Pilih Kelas --</option>
                  {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Nama Siswa:</label>
                <input type="text" name="new-student-name" required placeholder="Masukkan nama lengkap siswa" className="w-full p-3 border-2 border-red-300 rounded-xl focus:border-red-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <button type="submit" className="bg-green-500 hover:bg-green-600 text-white py-3 px-8 rounded-xl font-bold">➕ Tambah Siswa</button>
              <label className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-8 rounded-xl font-bold cursor-pointer inline-flex items-center gap-2">
                📁 Impor dari Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
              </label>
              <button type="button" onClick={handleDownloadTemplate} className="bg-gray-500 hover:bg-gray-600 text-white py-3 px-8 rounded-xl font-bold inline-flex items-center gap-2">
                📥 Download Template Excel
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(className => {
            const classStudents = students.filter(s => s.class === className).sort((a,b) => a.student_name.localeCompare(b.student_name));
            if (classStudents.length === 0) return null;
            return (
              <div key={className} className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4 text-red-700">{className} ({classStudents.length} siswa)</h3>
                <div className="space-y-2">
                  {classStudents.map(student => (
                    <div key={student.id} className="student-item bg-white p-4 rounded-xl flex justify-between items-center border-2 border-gray-200">
                      <div>
                        <p className="font-bold">{student.student_name}</p>
                        <p className="text-sm text-gray-500">{student.class}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteAllStudentData(student)} className="bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 px-4 rounded-xl text-sm font-bold" title="Hapus Semua Rekap">🧹 Hapus Data</button>
                        <button onClick={() => handleDeleteStudent(student)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl text-sm font-bold">🗑️ Hapus Siswa</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDailyReportPage = () => {
    const filteredRecords = habitRecords.filter(record => {
      if (selectedReportClass && record.class !== selectedReportClass) return false;
      return true;
    });

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-blue-700">📊 Rekap Harian</h2>
        </div>
        
        <div className="flex justify-center mb-6">
          <select 
            value={selectedReportClass} 
            onChange={(e) => setSelectedReportClass(e.target.value)}
            className="p-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="">Semua Kelas</option>
            {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="p-3 border">Nama</th>
                <th className="p-3 border">Kelas</th>
                <th className="p-3 border">Tanggal</th>
                <th className="p-3 border">Skor %</th>
                <th className="p-3 border">Kategori</th>
                <th className="p-3 border">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{record.student_name}</td>
                  <td className="p-3 border text-center">{record.class}</td>
                  <td className="p-3 border text-center">{record.date}</td>
                  <td className="p-3 border text-center font-bold">{record.total_score}%</td>
                  <td className="p-3 border text-center">{record.category}</td>
                  <td className="p-3 border text-center">
                    <button onClick={() => handleDeleteHabitRecord(record.id)} className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-lg transition-colors" title="Hapus Data">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Tidak ada data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMonthlyReportPage = () => {
    const filteredRecords = habitRecords.filter(record => {
      const recordDate = new Date(record.date);
      if (selectedReportClass && record.class !== selectedReportClass) return false;
      return recordDate.getMonth() + 1 === selectedMonth && recordDate.getFullYear() === selectedYear;
    });

    const filteredStudents = selectedReportClass ? students.filter(s => s.class === selectedReportClass) : students;

    const studentAverages = filteredStudents.map(student => {
      const studentRecords = filteredRecords.filter(r => r.student_name === student.student_name && r.class === student.class);
      if (studentRecords.length === 0) return null;
      
      const totalScore = studentRecords.reduce((sum, record) => sum + record.total_score, 0);
      const averageScore = Math.round(totalScore / studentRecords.length);
      
      return {
        ...student,
        averageScore,
        category: getCategory(averageScore),
        daysFilled: studentRecords.length
      };
    }).filter(Boolean);

    let chartData = [];
    if (selectedReportClass) {
      chartData = studentAverages.map((student: any) => ({
        name: student.student_name,
        'Rata-rata Skor': student.averageScore,
      }));
    } else {
      chartData = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(className => {
        const classStudents = studentAverages.filter((s: any) => s.class === className);
        const avgScore = classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s: any) => sum + s.averageScore, 0) / classStudents.length) : 0;
        return {
          name: className,
          'Rata-rata Skor': avgScore,
        };
      });
    }

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-700">📈 Rekap Bulanan</h2>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          <select 
            value={selectedReportClass} 
            onChange={(e) => setSelectedReportClass(e.target.value)}
            className="p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none"
          >
            <option value="">Semua Kelas</option>
            {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none"
          >
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:outline-none"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>

        {chartData.length > 0 && (
          <div className="mb-8 bg-yellow-50 p-6 rounded-2xl border-2 border-yellow-100">
            <h3 className="text-xl font-bold text-center text-yellow-800 mb-6">
              Grafik Rata-rata Skor {selectedReportClass ? `Siswa ${selectedReportClass}` : 'Per Kelas'}
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Rata-rata Skor" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-yellow-500 text-white">
                <th className="p-3 border">Nama</th>
                <th className="p-3 border">Kelas</th>
                <th className="p-3 border">Hari Mengisi</th>
                <th className="p-3 border">Rata-rata Skor %</th>
                <th className="p-3 border">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {studentAverages.length > 0 ? studentAverages.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{student.student_name}</td>
                  <td className="p-3 border text-center">{student.class}</td>
                  <td className="p-3 border text-center">{student.daysFilled} hari</td>
                  <td className="p-3 border text-center font-bold">{student.averageScore}%</td>
                  <td className="p-3 border text-center">{student.category}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Tidak ada data untuk bulan ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSemesterReportPage = () => {
    const filteredRecords = habitRecords.filter(record => {
      const recordDate = new Date(record.date);
      const isFirstHalf = recordDate.getMonth() < 6; // Jan - Jun
      const recordSemester = isFirstHalf ? 2 : 1;
      if (selectedReportClass && record.class !== selectedReportClass) return false;
      return recordSemester === selectedSemester && recordDate.getFullYear() === selectedSemesterYear;
    });

    const filteredStudents = selectedReportClass ? students.filter(s => s.class === selectedReportClass) : students;

    const studentAverages = filteredStudents.map(student => {
      const studentRecords = filteredRecords.filter(r => r.student_name === student.student_name && r.class === student.class);
      if (studentRecords.length === 0) return null;
      
      const totalScore = studentRecords.reduce((sum, record) => sum + record.total_score, 0);
      const averageScore = Math.round(totalScore / studentRecords.length);
      
      return {
        ...student,
        averageScore,
        category: getCategory(averageScore),
        daysFilled: studentRecords.length
      };
    }).filter(Boolean);

    // Calculate monthly data for chart
    const semesterMonths = selectedSemester === 1 ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6];
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const chartData = semesterMonths.map(month => {
      const monthRecords = filteredRecords.filter(r => new Date(r.date).getMonth() + 1 === month);
      const avg = monthRecords.length > 0 
        ? Math.round(monthRecords.reduce((sum, r) => sum + r.total_score, 0) / monthRecords.length)
        : 0;
      return {
        name: monthNames[month - 1],
        skor: avg
      };
    });

    const handlePrint = () => {
      window.print();
    };

    const handleExportWord = () => {
      const elementId = 'printable-report';
      const filename = `Rekap_Semester_${selectedReportClass || 'Semua'}_${selectedSemesterYear}_S${selectedSemester}`;
      const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 8px; text-align: left; } .text-center { text-align: center; } .font-bold { font-weight: bold; } .kop { text-align: center; border-bottom: 3px double black; padding-bottom: 10px; margin-bottom: 20px; } .kop h1 { margin: 0; font-size: 20pt; } .kop p { margin: 0; font-size: 10pt; } .signature-table { width: 100%; margin-top: 50px; border: none !important; } .signature-table td { border: none !important; }</style></head><body>";
      const postHtml = "</body></html>";
      const content = document.getElementById(elementId)?.innerHTML || '';
      const html = preHtml + content + postHtml;

      const blob = new Blob(['\ufeff', html], {
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      document.body.appendChild(downloadLink);
      downloadLink.href = url;
      downloadLink.download = filename + '.doc';
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    };

    const downloadChart = () => {
      const svg = document.querySelector('.semester-chart svg');
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const svgSize = svg.getBoundingClientRect();
      canvas.width = svgSize.width * 2; // Higher resolution
      canvas.height = svgSize.height * 2;
      
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `Grafik_Kemajuan_${selectedReportClass || 'Semua'}_S${selectedSemester}.png`;
          downloadLink.click();
        }
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8">
        <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl print:hidden">← Kembali ke Beranda</button>
        <div className="text-center mb-6 print:hidden">
          <h2 className="text-3xl font-bold text-purple-700">🏆 Rekap Semester</h2>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-2xl mb-8 border-2 border-purple-100 print:hidden">
          <h3 className="text-xl font-bold mb-4 text-purple-800">⚙️ Pengaturan Laporan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nama Sekolah:</label>
              <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Alamat Sekolah:</label>
              <input type="text" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Nama Kepala Sekolah:</label>
              <input type="text" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">NIP Kepala Sekolah (Opsional):</label>
              <input type="text" value={principalNip} onChange={(e) => setPrincipalNip(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Contoh: 19800101 200501 1 001" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Nama Guru Kelas:</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">NIP Guru Kelas (Opsional):</label>
              <input type="text" value={teacherNip} onChange={(e) => setTeacherNip(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Contoh: 19850202 201001 2 002" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <button onClick={() => setShowReportPreview(true)} className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-8 rounded-xl font-bold shadow-lg flex items-center gap-2">
              👁️ Preview Laporan
            </button>
          </div>
        </div>

        <div className="mb-8 bg-white p-6 rounded-2xl border-2 border-purple-100 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-purple-800">📈 Grafik Kemajuan Semester</h3>
            <button onClick={downloadChart} className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-bold flex items-center gap-2">
              📥 Download Grafik
            </button>
          </div>
          <div className="h-[300px] w-full semester-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="skor" name="Rata-rata Skor (%)" fill="#9333ea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 justify-center print:hidden">
          <select 
            value={selectedReportClass} 
            onChange={(e) => setSelectedReportClass(e.target.value)}
            className="p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none"
          >
            <option value="">Semua Kelas</option>
            {['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={selectedSemester} 
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none"
          >
            <option value={1}>Semester 1 (Jul - Des)</option>
            <option value={2}>Semester 2 (Jan - Jun)</option>
          </select>
          <select 
            value={selectedSemesterYear} 
            onChange={(e) => setSelectedSemesterYear(Number(e.target.value))}
            className="p-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-purple-500 text-white">
                <th className="p-3 border">Nama</th>
                <th className="p-3 border">Kelas</th>
                <th className="p-3 border">Hari Mengisi</th>
                <th className="p-3 border">Rata-rata Skor %</th>
                <th className="p-3 border">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {studentAverages.length > 0 ? studentAverages.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{student.student_name}</td>
                  <td className="p-3 border text-center">{student.class}</td>
                  <td className="p-3 border text-center">{student.daysFilled} hari</td>
                  <td className="p-3 border text-center font-bold">{student.averageScore}%</td>
                  <td className="p-3 border text-center">{student.category}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Tidak ada data untuk semester ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showReportPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl relative my-8">
              <button onClick={() => setShowReportPreview(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl print:hidden">✕</button>
              
              <div className="flex gap-4 mb-6 print:hidden">
                <button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  🖨️ Cetak Laporan
                </button>
                <button onClick={handleExportWord} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  📄 Simpan Word (.doc)
                </button>
              </div>

              <div id="printable-report" className="bg-white p-4 text-black font-serif">
                {/* Kop Sekolah */}
                <div className="flex items-center border-b-4 border-double border-black pb-4 mb-6">
                  <div className="flex-1 text-center">
                    <h1 className="text-2xl font-bold uppercase">{schoolName}</h1>
                    <p className="text-sm italic">{schoolAddress}</p>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-center underline mb-6 uppercase">LAPORAN REKAPITULASI SEMESTER</h2>
                
                <div className="mb-4 grid grid-cols-2 text-sm">
                  <div>
                    <p><b>Kelas:</b> {selectedReportClass || 'Semua Kelas'}</p>
                    <p><b>Semester:</b> {selectedSemester}</p>
                  </div>
                  <div className="text-right">
                    <p><b>Tahun:</b> {selectedSemesterYear}</p>
                    <p><b>Tanggal Cetak:</b> {new Date().toLocaleDateString('id-ID')}</p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-2 text-center w-10">No</th>
                      <th className="border border-black p-2">Nama Siswa</th>
                      <th className="border border-black p-2 text-center">Kelas</th>
                      <th className="border border-black p-2 text-center">Skor (%)</th>
                      <th className="border border-black p-2">Kategori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentAverages.map((student: any, index: number) => (
                      <tr key={student.id}>
                        <td className="border border-black p-2 text-center">{index + 1}</td>
                        <td className="border border-black p-2">{student.student_name}</td>
                        <td className="border border-black p-2 text-center">{student.class}</td>
                        <td className="border border-black p-2 text-center font-bold">{student.averageScore}%</td>
                        <td className="border border-black p-2">{student.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Tanda Tangan */}
                <div className="mt-12 grid grid-cols-2 text-center text-sm">
                  <div>
                    <p className="mb-20">Mengetahui,<br />Kepala Sekolah</p>
                    <p className="font-bold underline">{principalName}</p>
                    {principalNip && <p>NIP. {principalNip}</p>}
                  </div>
                  <div>
                    <p className="mb-20">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />Guru Kelas</p>
                    <p className="font-bold underline">{teacherName}</p>
                    {teacherNip && <p>NIP. {teacherNip}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTeacherManagementPage = () => (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
      <h2 className="text-3xl font-bold text-center text-teal-700 mb-6">👨‍🏫 Kelola Data Guru</h2>
      
      <div className="bg-teal-50 p-6 rounded-2xl mb-8 border-2 border-teal-200">
        <h3 className="text-xl font-bold mb-4 text-teal-800">Tambah Akun Guru</h3>
        <form onSubmit={handleAddTeacher} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-bold mb-2">Nama Guru:</label>
            <input type="text" name="teacher-name" required placeholder="Contoh: Budi Santoso" className="w-full p-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold mb-2">Email Guru (Akun Google):</label>
            <input type="email" name="teacher-email" required placeholder="Contoh: guru@gmail.com" className="w-full p-3 border-2 border-teal-300 rounded-xl focus:border-teal-500 focus:outline-none" />
          </div>
          <button type="submit" className="bg-teal-500 hover:bg-teal-600 text-white py-3 px-8 rounded-xl font-bold h-[52px]">➕ Tambah Guru</button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold mb-4 text-teal-800">Daftar Guru Terdaftar ({teachersList.length})</h3>
        {teachersList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada guru yang didaftarkan.</p>
        ) : (
          teachersList.map(teacher => (
            <div key={teacher.id} className="bg-white p-4 rounded-xl flex justify-between items-center border-2 border-gray-200 shadow-sm">
              <div>
                <p className="font-bold text-lg">{teacher.name}</p>
                <p className="text-sm text-gray-500">{teacher.email}</p>
                <p className="text-xs text-gray-400 mt-1">Ditambahkan: {new Date(teacher.addedAt).toLocaleDateString('id-ID')}</p>
              </div>
              <button onClick={() => handleRemoveTeacher(teacher.email)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl text-sm font-bold">🗑️ Hapus Akses</button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAdminPage = () => (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <button onClick={() => setCurrentPage('home')} className="mb-6 bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-xl">← Kembali ke Beranda</button>
      <h2 className="text-3xl font-bold text-center text-indigo-700 mb-6">👑 Kelola Akses Sekolah</h2>
      
      <div className="bg-indigo-50 p-6 rounded-2xl mb-8">
        <h3 className="text-xl font-bold mb-4">Tambah Email Sekolah yang Disetujui</h3>
        <form onSubmit={handleAddApprovedSchool} className="flex gap-4">
          <input type="email" name="school-email" required placeholder="email.sekolah@contoh.com" className="flex-1 p-3 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:outline-none" />
          <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-8 rounded-xl font-bold">Setujui Akses</button>
        </form>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Daftar Sekolah yang Disetujui</h3>
        {approvedSchoolsList.length === 0 ? (
          <p className="text-gray-500">Belum ada sekolah yang disetujui.</p>
        ) : (
          <div className="space-y-3">
            {approvedSchoolsList.map(school => (
              <div key={school.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="font-bold text-lg">{school.email}</span>
                <button onClick={() => handleRemoveApprovedSchool(school.id)} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-xl text-sm font-bold">Cabut Akses</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (currentPage === 'landing' && !isSharedMode && !isFirebaseAuthenticated) {
    return renderLandingPage();
  }

  if (currentPage === 'login' && !isSharedMode && !isFirebaseAuthenticated) {
    return renderLoginPage();
  }

  if (checkingApproval && !isSharedMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans text-white">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Memeriksa Akses...</h2>
          <p className="text-gray-600 mb-6">Mohon tunggu sebentar sementara kami memverifikasi akun Anda.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-6 rounded-xl font-bold transition-colors"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  if (!isFirebaseAuthenticated && !isSharedMode) {
    return renderLandingPage();
  }

  if (!isSharedMode && !isApproved && !isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-4 border-red-50">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Lisensi Tidak Aktif</h1>
          <p className="text-lg text-gray-600 mb-6 leading-relaxed">
            Akun <b>{auth.currentUser?.email}</b> tidak terdaftar dalam sistem lisensi <b>SIMO-G7KAIH</b>.
          </p>
          
          <div className="bg-gray-50 p-6 rounded-2xl mb-8 border border-gray-100 italic text-sm text-gray-500">
            "Akses dashboard hanya tersedia untuk sekolah dan guru yang telah melakukan aktivasi lisensi resmi."
          </div>

          <div className="space-y-4">
            <a 
              href="http://lynk.id/bugurulela" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-lg font-bold shadow-xl shadow-indigo-100 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" /> Beli Lisensi Sekarang
            </a>
            <button 
              onClick={() => auth.signOut()}
              className="w-full bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 py-4 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" /> Keluar Akun
            </button>
          </div>
          
          <p className="mt-8 text-xs text-gray-400">
            Sudah membeli tapi belum bisa masuk? Hubungi admin via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* App Bar / Back Button for Sub-pages */}
        {!isSharedMode && currentPage !== 'home' && (
          <div className="flex justify-between items-center mb-6 print:hidden">
            <button 
              onClick={() => setCurrentPage('home')}
              className="flex items-center gap-2 text-white hover:text-purple-100 font-bold bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-2xl transition-all border border-white/20 shadow-lg"
            >
              <ChevronLeft className="w-5 h-5" /> Kembali ke Beranda
            </button>
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/20">
              {currentPage.toUpperCase().replace('-', ' ')} {isDemo && "(DEMO)"}
            </div>
          </div>
        )}

        {currentPage === 'home' && renderHomePage()}
        {currentPage === 'form' && renderFormPage()}
        {currentPage === 'student-management' && renderStudentManagementPage()}
        {currentPage === 'teacher-management' && renderTeacherManagementPage()}
        {currentPage === 'daily' && renderDailyReportPage()}
        {currentPage === 'monthly' && renderMonthlyReportPage()}
        {currentPage === 'semester' && renderSemesterReportPage()}
        {currentPage === 'admin' && isOwner && renderAdminPage()}
      </div>


      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 text-center">🔒 Masukkan Password Guru</h3>
            <div className="mb-4">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                placeholder="Password" 
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none" 
              />
            </div>
            <div className="mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="w-5 h-5" />
                <span>Tampilkan Password</span>
              </label>
            </div>
            {passwordError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-center">Password salah! Silakan coba lagi.</div>}
            <div className="flex gap-4">
              <button onClick={handlePasswordSubmit} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-bold">✅ Buka</button>
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-xl font-bold">❌ Batal</button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className={`fixed top-4 right-4 ${isErrorToast ? 'bg-red-500' : 'bg-green-500'} text-white py-4 px-6 rounded-xl shadow-2xl z-50`}>
          {toastMessage}
        </div>
      )}

      {showDebug && (
        <div className="fixed bottom-4 left-4 right-4 bg-black bg-opacity-90 text-green-400 p-4 rounded-2xl shadow-2xl z-[100] font-mono text-xs max-h-60 overflow-y-auto border-2 border-green-900">
          <div className="flex justify-between items-center mb-2 border-b border-green-900 pb-2">
            <span className="font-bold">DEBUG LOGS</span>
            <button onClick={() => setShowDebug(false)} className="text-white hover:text-red-400">✕ Close</button>
          </div>
          {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
          {debugLogs.length === 0 && <div>No logs yet...</div>}
        </div>
      )}
    </div>
  );
}
