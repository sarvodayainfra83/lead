import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Upload, Camera, CheckCircle2, RotateCcw, MapPin, Loader2, Trash2, X, AlertTriangle
} from 'lucide-react';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { attendanceApi } from '../../api/attendanceApi';
import { useAuthStore } from '../../store/authStore';

export default function AttendanceModal({ isOpen, onClose, onSaved, existingLogs = [] }) {
  const { user } = useAuthStore();

  const [attendanceStatus, setAttendanceStatus] = useState(() =>
    attendanceApi.getUserTodayAttendanceStatus(existingLogs, user)
  );

  const [userName, setUserName] = useState(user?.name || '');
  const [status, setStatus] = useState('In');
  const [photoData, setPhotoData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Detect mobile device vs desktop
  useEffect(() => {
    const checkIsMobile = () => {
      if (typeof window === 'undefined') return false;
      const ua = navigator.userAgent || navigator.vendor || window.opera || '';
      const isMobileUA = /android|iphone|ipad|ipod|windows phone|iemobile|mobile/i.test(ua);
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isSmallScreen = window.innerWidth <= 768;
      return isMobileUA || (isTouch && isSmallScreen);
    };

    setIsMobile(checkIsMobile());

    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsWebcamOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      const statusInfo = attendanceApi.getUserTodayAttendanceStatus(existingLogs, user);
      setAttendanceStatus(statusInfo);

      try {
        const savedSessionStr = sessionStorage.getItem('attendance_camera_session');
        if (savedSessionStr) {
          const savedSession = JSON.parse(savedSessionStr);
          const isFresh = (Date.now() - (savedSession.timestamp || 0)) < 10 * 60 * 1000;
          if (isFresh && savedSession.status && statusInfo.allowedStatuses.includes(savedSession.status)) {
            setStatus(savedSession.status);
          } else {
            setStatus(statusInfo.defaultStatus);
          }
        } else {
          setStatus(statusInfo.defaultStatus);
        }
      } catch (e) {
        setStatus(statusInfo.defaultStatus);
      }

      setUserName(user?.name || '');
      setPhotoData(null);
      setFileName('');
      setLocation(null);
      setAddress('');
      stopWebcam();
    } else {
      stopWebcam();
    }
  }, [isOpen, user, existingLogs]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const statusOptions = attendanceStatus.allowedStatuses.map(s => ({
    value: s,
    label: s
  }));

  const savePendingSession = (selectedStatus) => {
    try {
      sessionStorage.setItem('attendance_camera_session', JSON.stringify({
        status: selectedStatus || status,
        userName: user?.name || userName,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.warn('Failed to save attendance session:', err);
    }
  };

  const openCameraPicker = () => {
    savePendingSession(status);
    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    savePendingSession(status);
    fileInputRef.current?.click();
  };

  // Compress image to keep payload lightweight and responsive
  const compressAndReadImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1000;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check 50MB file size limit (52428800 bytes)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds the 50 MB limit');
      if (e.target) e.target.value = '';
      return;
    }

    try {
      setFileName(file.name);
      const dataUrl = await compressAndReadImage(file);
      setPhotoData(dataUrl);
      fetchCurrentLocation();
    } catch (err) {
      console.error('Failed to process image:', err);
      toast.error('Failed to load image file');
    }
  };

  const [cameraFacingMode, setCameraFacingMode] = useState('user');

  const startWebcam = async (facing = 'environment') => {
    stopWebcam();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;
      setCameraFacingMode(facing);
      setIsWebcamOpen(true);
    } catch (err) {
      console.error('Webcam access error:', err);
      // getUserMedia not available — fall back to gallery picker
      toast.error('Camera not available. Please choose from gallery.');
      openFilePicker();
    }
  };

  const toggleCameraFacingMode = () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    startWebcam(nextFacing);
  };

  const captureWebcamPhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhotoData(dataUrl);
      setFileName(`attendance_${Date.now()}.jpg`);
      stopWebcam();
      fetchCurrentLocation();
    } catch (err) {
      console.error('Failed to capture webcam frame:', err);
      toast.error('Failed to capture photo from webcam');
    }
  };

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ latitude: lat, longitude: lng });

        try {
          const addr = await attendanceApi.reverseGeocode(lat, lng);
          setAddress(addr);
        } catch (e) {
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
          setLoadingLocation(false);
          toast.success('Image and location captured');
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLoadingLocation(false);
        setLocation(null);
        setAddress('Location unavailable');
        toast.success('Image uploaded');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleRemovePhoto = () => {
    setPhotoData(null);
    setFileName('');
    setLocation(null);
    setAddress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleCloseModal = () => {
    try {
      sessionStorage.removeItem('attendance_camera_session');
    } catch (e) { }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (attendanceStatus.isLocked) {
      toast.error('You have already marked OUT for today. Next check-in opens tomorrow after 12:00 AM IST.');
      return;
    }

    if (status === 'In' && attendanceStatus.hasMarkedIn) {
      toast.error('You have already marked IN today. You can only mark Half Day or OUT.');
      return;
    }

    if (status === 'Out' && !attendanceStatus.hasMarkedIn && !attendanceStatus.hasMarkedHalfDay) {
      toast.error('You cannot mark OUT without marking IN first.');
      return;
    }

    const currentUserName = user?.name || userName;

    if (!currentUserName) {
      toast.error('User name is required');
      return;
    }
    if (!status) {
      toast.error('Status is required');
      return;
    }
    if (!photoData) {
      toast.error(isMobile ? 'Please click a photo to verify attendance' : 'Please upload an image to verify attendance');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}/${month}/${year}`;
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
      const fullTimestamp = `${dateStr} ${timeStr}`;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      const formatted12hTime = `${String(hour12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

      const isMarkingOut = status === 'Out';
      const userUuid = await attendanceApi.getUserIdUuid(user);

      await attendanceApi.saveAttendanceLog({
        userId: userUuid || user?.dbId || (typeof user?.id === 'string' && user.id.includes('-') ? user.id : null),
        userName: currentUserName,
        date: dateStr,
        timestamp: fullTimestamp,
        timestampMs: now.getTime(),
        inTime: !isMarkingOut ? formatted12hTime : null,
        outTime: isMarkingOut ? formatted12hTime : null,
        status: status,
        photoUrl: photoData,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        locationName: address || 'Current Location'
      });

      try {
        sessionStorage.removeItem('attendance_camera_session');
      } catch (e) { }

      toast.success(`Attendance (${status}) recorded successfully!`);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error('Failed to save attendance record');
    } finally {
      setSaving(false);
    }
  };

  const currentUserName = user?.name || userName || 'Employee';

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleCloseModal}
      title="ATTENDANCE"
      onSubmit={handleSubmit}
      submitText={attendanceStatus.isLocked ? 'COMPLETED FOR TODAY' : (saving ? 'Saving...' : 'SAVE')}
      disabled={attendanceStatus.isLocked}
      loading={saving}
      maxWidth="max-w-md"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Banner: If marked OUT, locked until 12:00 AM IST */}
        {attendanceStatus.isLocked && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs shadow-2xs">
            <AlertTriangle size={17} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-950">Attendance Completed for Today</p>
              <p className="text-amber-800 leading-relaxed">
                You have already marked <span className="font-bold text-amber-950">OUT</span> for today ({attendanceStatus.todayDate}). No further attendance can be marked today. You will be able to mark <span className="font-bold text-amber-950">IN</span> tomorrow after 12:00 AM IST.
              </p>
            </div>
          </div>
        )}

        {/* Banner: If already marked IN, show guidance */}
        {!attendanceStatus.isLocked && attendanceStatus.hasMarkedIn && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-900 text-xs">
            <CheckCircle2 size={15} className="text-blue-600 flex-shrink-0" />
            <span>Already marked <strong>IN</strong> today. You can now mark <strong>Half Day</strong> or <strong>OUT</strong>.</span>
          </div>
        )}

        {/* NAME * (Pre-filled with logged-in user name & Not Editable) */}
        <div className="space-y-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-medium">
            NAME *
          </label>
          <input
            type="text"
            readOnly
            disabled
            value={currentUserName}
            className="w-full px-3 py-2 text-xs md:text-sm bg-gray-100/90 border border-gray-300 rounded-lg text-gray-800 font-semibold cursor-not-allowed select-none focus:outline-none h-[38px]"
          />
        </div>

        {/* STATUS * */}
        <div className="space-y-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-medium">
            STATUS *
          </label>
          {attendanceStatus.isLocked ? (
            <input
              type="text"
              readOnly
              disabled
              value="OUT (Completed for Today)"
              className="w-full px-3 py-2 text-xs md:text-sm bg-gray-100/90 border border-gray-300 rounded-lg text-gray-500 font-semibold cursor-not-allowed select-none focus:outline-none h-[38px]"
            />
          ) : (
            <SearchableDropdown
              options={statusOptions}
              value={status}
              onChange={(val) => {
                setStatus(val);
                savePendingSession(val);
              }}
              placeholder="Select status"
            />
          )}
        </div>

        {/* IMAGE FIELD (Click Photo on Mobile / Upload Image on Desktop) */}
        <div className="space-y-1.5">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-medium">
            {isMobile ? 'CLICK PHOTO *' : 'UPLOAD IMAGE *'}
          </label>

          {/* Hidden File Input for Desktop & Mobile Gallery */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Hidden File Input for gallery / file picker fallback */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* 1. Live Desktop Webcam Stream View */}
          {isWebcamOpen ? (
            <div className="space-y-2 bg-slate-900 p-2.5 rounded-lg border border-slate-700 animate-in fade-in">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={captureWebcamPhoto}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Camera size={15} /> Capture Photo
                </button>
                <button
                  type="button"
                  onClick={toggleCameraFacingMode}
                  className="bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg py-2 px-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Flip Camera (Front/Back)"
                >
                  <RotateCcw size={14} /> Flip
                </button>
                <button
                  type="button"
                  onClick={stopWebcam}
                  className="bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <X size={15} /> Cancel
                </button>
              </div>
            </div>
          ) : photoData ? (
            /* 2. Photo Uploaded/Captured State */
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-3 transition-all duration-200 animate-in fade-in">
              <img
                src={photoData}
                alt="Uploaded attendance"
                className="w-12 h-12 rounded-md object-cover border border-emerald-300 flex-shrink-0 shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>{isMobile ? 'Photo Captured' : 'Uploaded'}</span>
                </div>
                {loadingLocation ? (
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                    <Loader2 size={11} className="animate-spin text-emerald-600" />
                    <span>Fetching GPS Location...</span>
                  </div>
                ) : (
                  <>
                    {location && (
                      <p className="text-[11px] font-mono text-gray-700 truncate leading-tight mt-0.5 font-medium">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </p>
                    )}
                    {address && (
                      <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5" title={address}>
                        {address}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isMobile) {
                      startWebcam('environment');
                    } else {
                      startWebcam('user');
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700 border border-emerald-200 bg-white shadow-xs transition-colors cursor-pointer"
                  title="Retake Photo"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 border border-red-200 bg-white shadow-xs transition-colors cursor-pointer"
                  title="Remove Image"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* 3. Initial Empty State */
            <div className="space-y-2">
              {isMobile ? (
                /* Mobile UI: In-app camera is PRIMARY to avoid tab kill on low-RAM Android */
                <>
                  <button
                    type="button"
                    onClick={() => startWebcam('environment')}
                    className="w-full border border-sky-200 hover:border-sky-300 bg-sky-50/70 hover:bg-sky-100/80 text-sky-800 rounded-lg py-2.5 px-4 text-xs md:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-xs cursor-pointer active:scale-[0.99]"
                  >
                    <Camera size={16} /> OPEN CAMERA
                  </button>
                  <div className="flex items-center justify-center gap-3 pt-0.5">
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="text-[11px] text-gray-600 hover:text-indigo-600 flex items-center gap-1 font-medium transition cursor-pointer hover:underline"
                    >
                      <Upload size={12} /> Choose from Gallery
                    </button>
                  </div>
                </>
              ) : (
                /* Desktop UI: Main option is Upload from File, plus Webcam option */
                <>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="w-full border border-sky-200 hover:border-sky-300 bg-sky-50/70 hover:bg-sky-100/80 text-sky-800 rounded-lg py-2.5 px-4 text-xs md:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-xs cursor-pointer active:scale-[0.99]"
                  >
                    <Upload size={16} /> UPLOAD FROM FILE
                  </button>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => startWebcam('user')}
                      className="text-[11px] text-gray-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition cursor-pointer hover:underline"
                    >
                      <Camera size={12} /> Or click photo using webcam
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalForm>
  );
}

