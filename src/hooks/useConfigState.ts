import { useState, useEffect } from 'react';

export const useConfigState = () => {
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [showPublisherModal, setShowPublisherModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSystemModal(false);
        setShowBrandModal(false);
        setShowPublisherModal(false);
        setShowStrategyModal(false);
        setShowAccountModal(false);
        setShowSaveModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return {
    showSystemModal, setShowSystemModal,
    showPublisherModal, setShowPublisherModal,
    showStrategyModal, setShowStrategyModal,
    showBrandModal, setShowBrandModal,
    showAccountModal, setShowAccountModal,
    showSaveModal, setShowSaveModal
  };
};