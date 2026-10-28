! 典型的 AutoMod 逻辑控制程序（.m）：只有逻辑块，没有 begin model 外壳
! if 不需要 end，用 begin/end 分组

begin P_arrive arriving procedure
  move into Q_in
  send to P_load
end

begin P_load arriving procedure
  if var_busy > 0 then
    begin
      wait for 30 sec
    end
  else
    begin
      set var_busy = 1
    end
  send to P_process
end

begin P_process arriving procedure
  move into Q_process
  wait to be ordered on OL_process
end

begin P_done arriving procedure
  stop
end
