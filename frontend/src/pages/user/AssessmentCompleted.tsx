import React, { useEffect } from "react";
import { CheckCircle, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { userPath } from "../../routes/EncryptRoute";

const AssessmentCompleted: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // get id from URL params

  const handleLogout = () => {
    if (id) {
    navigate(userPath("sessionEnd", id));
    }
  };
// ── Prevent Browser Back/Forward Navigation ──
  useEffect(() => {
   

    // Push a state to prevent back navigation
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Push state again to prevent actual navigation
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
  return (
    <div className="min-h-screen bg-[#050A24] flex items-center justify-center relative overflow-hidden">
      
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mb-6"
        >
          <CheckCircle className="h-10 w-10 text-green-400" />
        </motion.div>

        <motion.h1
          className="text-white text-3xl sm:text-4xl font-bold mb-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Thank You !
        </motion.h1>

        <motion.p
          className="text-green-400 text-base sm:text-lg font-medium mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
        >
          Assessment Completed Successfully
        </motion.p>

        <motion.button
          onClick={handleLogout}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#2D55FB] hover:bg-[#1e3fd4] text-white font-medium rounded-lg transition-colors"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </motion.button>
      </div>
    </div>
  );
};

export default AssessmentCompleted;
