import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useDevice } from './hooks/useDevice';
import MobileApp from './MobileApp';
import DesktopApp from './DesktopApp';

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