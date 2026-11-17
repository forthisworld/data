import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h4 className="font-semibold mb-3">About</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/forthisworld/data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Source Code (MIT) · Data (ODbL)
                </a>
              </li>
            </ul>
          </div>

          {/* Get Involved */}
          <div>
            <h4 className="font-semibold mb-3">Get Involved</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/contribute" className="hover:text-foreground transition-colors">
                  Contribute Data
                </Link>
              </li>
              <li>
                <Link href="/in/info-requests" className="hover:text-foreground transition-colors">
                  RTI Tracker
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/forthisworld/data/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Report Issues
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-3">Legal</h4>
            <p className="text-sm text-muted-foreground">
              All data sourced from official public records.
              For informational purposes only.
            </p>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} data.ftw · Open Source · No Cookies · No Tracking
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

