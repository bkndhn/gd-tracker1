import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TeamChat } from './TeamChat';

/** Floating chat button so shop staff, warehouse and admins can open team chat from any page. */
export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="icon" aria-label="Open team chat"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-40 h-14 w-14 rounded-full shadow-lg">
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-2 pt-10">
          <SheetHeader className="sr-only"><SheetTitle>Team chat</SheetTitle></SheetHeader>
          {open && <TeamChat compact />}
        </SheetContent>
      </Sheet>
    </>
  );
}
