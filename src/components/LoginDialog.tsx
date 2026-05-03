import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailAuth } from "./EmailAuth";

export function LoginDialog({
  open,
  onOpenChange,
  title = "登录后继续",
  description = "登录或注册一个账号，即可创建并保存你的角色。",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <EmailAuth onSuccess={() => onOpenChange(false)} showForgot={false} />
      </DialogContent>
    </Dialog>
  );
}
