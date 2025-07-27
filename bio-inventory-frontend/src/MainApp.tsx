import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useDevice } from './hooks/useDevice.ts';
import MobileApp from './MobileApp.tsx';
import DesktopApp from './DesktopApp.tsx';

const MainApp = () => {
    const device = useDevice();

    if (device.isMobile) {
        return (
            <Router>
                <MobileApp />
            </Router>
        );
    }

    return <DesktopApp />;
};

export default MainApp;