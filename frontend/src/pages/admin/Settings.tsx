import { useState } from 'react'
import AdminLayout from '../../common/AdminLayout'

const Settings = () => {
    const [activeMenuItem, setActiveMenuItem] = useState("settings");
  return (
   <AdminLayout
   heading="Candidate Settings"
      subheading="Manage your application settings and preferences."
      showSearch={false}
      activeMenuItem={activeMenuItem}
      onMenuItemClick={setActiveMenuItem}
   >

  

        <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Settings Page</h2>
            <p className="text-gray-700">This page is under development. Please check back later for updates.</p>
        </div>



   </AdminLayout>
  )
}

export default Settings