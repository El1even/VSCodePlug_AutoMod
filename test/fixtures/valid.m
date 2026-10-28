begin model demo
version: 1.0

begin process P
  integer var_count
  real var_cycle
  load LoadA
  queue Q_buffer

  begin P_arrive
    move load to P_station
  end

  begin P_station
    if var_count > 10 then
      move load to P_hold
    else
      move load to P_done
    end
    inc var_count
  end

  begin P_hold
    wait for 5 sec
    move load to P_done
  end

  begin P_done
    set var_cycle = 10 / 2
    stop
  end
end
end model
