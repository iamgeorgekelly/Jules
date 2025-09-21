
import React from 'react';

const Header: React.FC = () => {
  return (
    <div className="text-center p-4 md:p-6">
      <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 mb-2">
        Product Scene Generator
      </h1>
      <p className="text-slate-400 max-w-3xl mx-auto">
       Upload a room scene, select products for the AI to replace, provide detailed shots, and generate entirely new scenes.
      </p>
    </div>
  );
};

export default Header;
