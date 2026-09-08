import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

export const DynamicBanner: React.FC = () => {
  const [bannerUrl, setBannerUrl] = useState<string | null>(() => {
    return localStorage.getItem('portal_hero_image');
  });
  const [loading, setLoading] = useState<boolean>(!bannerUrl);

  useEffect(() => {
    let active = true;

    const carregarBanner = async () => {
      // 1. Try direct Supabase query on configuracao_sistema table
      try {
        const { data, error } = await supabase
          .from('configuracao_sistema')
          .select('main_banner_url')
          .eq('id', 'geral')
          .maybeSingle();

        if (active && data && (data as any).main_banner_url) {
          const url = (data as any).main_banner_url;
          setBannerUrl(url);
          localStorage.setItem('portal_hero_image', url);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Direct configuracao_sistema Supabase query failed:", err);
      }

      // 2. Try direct Supabase query on system_settings table
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('main_banner_url')
          .eq('id', 1)
          .single();

        if (active && data && data.main_banner_url) {
          setBannerUrl(data.main_banner_url);
          localStorage.setItem('portal_hero_image', data.main_banner_url);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Direct system_settings Supabase query failed, falling back to local API:", err);
      }

      // 3. Fallback: Try getting from local API (which handles local JSON storage fallback)
      try {
        const response = await fetch('/api/system-settings');
        if (response.ok) {
          const data = await response.json();
          if (active && data?.main_banner_url) {
            setBannerUrl(data.main_banner_url);
            localStorage.setItem('portal_hero_image', data.main_banner_url);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Local API fallback also failed:", err);
      }

      // 4. Final default hardcoded fallback if nothing exists in storage/db
      if (active && !bannerUrl) {
        setBannerUrl('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200&auto=format&fit=crop');
        setLoading(false);
      }
    };

    carregarBanner();

    return () => {
      active = false;
    };
  }, [bannerUrl]);

  // Visual Fallback / Skeleton Loader (Rule 3)
  if (loading || !bannerUrl) {
    return (
      <div className="w-full max-w-5xl mx-auto mb-12" id="banner-skeleton-container">
        <div className="w-full h-40 md:h-52 bg-slate-100 animate-pulse rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Carregando Comunicação Visual...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="w-full max-w-5xl mx-auto mb-12 bg-slate-100 flex items-center justify-center rounded-2xl border border-slate-200 shadow-md overflow-hidden"
      id="dynamic-banner-container"
    >
      <img 
        src={bannerUrl} 
        alt="Banner de Comunicação Visual" 
        className="w-full h-auto object-contain rounded-2xl max-h-[500px] hover:scale-[1.005] transition-transform duration-700"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.src = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200&auto=format&fit=crop';
        }}
      />
    </motion.div>
  );
};
