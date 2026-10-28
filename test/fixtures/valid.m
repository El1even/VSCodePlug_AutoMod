begin model demo
begin process P
  integer var_count
  queue Q_buffer
  load L_a

  begin P_arrive arriving procedure
    move into Q_buffer
    if var_count > 10 then
      begin
        move to P_hold
      end
    else
      begin
        move to P_done
      end
    inc var_count
  end

  begin P_hold arriving procedure
    wait for 5 sec
    move to P_done
  end

  begin P_done arriving procedure
    stop
  end
end
end model
