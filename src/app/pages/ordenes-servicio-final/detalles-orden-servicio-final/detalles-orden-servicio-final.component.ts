import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ModalComponent } from '../../../components/modal/modal.component';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../services/data.service';
import { OrdenesServicioService } from '../../../services/ordenes-servicio.service';
import { AlertService } from '../../../services/alert.service';
import { FechaPipe } from '../../../pipes/fecha.pipe';
import { FechaHoraPipe } from '../../../pipes/fecha-hora.pipe';
import { OrdenesServicioHistorialService } from '../../../services/ordenes-servicio-historial.service';
import { AuthService } from '../../../services/auth.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { UsuariosService } from '../../../services/usuarios.service';
import { OrdenesServicioToTecnicosService } from '../../../services/ordenes-servicio-to-tecnicos.service';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { Location } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-detalles-orden-servicio-final',
  templateUrl: './detalles-orden-servicio-final.component.html',
  styleUrls: [],
  imports: [
    RouterModule,
    FormsModule,
    NgSelectModule,
    ReactiveFormsModule,
    ModalComponent,
    CommonModule,
    FechaPipe,
    FechaHoraPipe
  ]
})
export default class DetallesOrdenServicioFinalComponent implements OnInit {

  // Tiempos
  public demoraSolucion: string = '';

  // Flags
  public showSeccion: string = 'Detalles';      // Detalles | Historial
  public showModalAsignacion: boolean = false;  // Asignacion de tecnico

  // Tecnico seleccionado
  public tecnicoSeleccionado = '';
  public tecnicosAsignados: any[] = [];
  public tecnicosParaAsignar: any[] = [];

  // Solicitud solucionada
  public showSinSolucion: boolean = false;
  public motivoSinSolucion: string = '';

  // Solicitud sin solucion
  public showSolucionado: boolean = false;
  public comentariosSolucion: string = '';

  // Solicitud pendiente
  public showPendiente: boolean = false;
  public motivoPendiente: string = '';

  // Historial
  public historialOrden: any[] = [];

  public idSolicitud = '';
  public orden = null;
  public tecnicos: any[] = []

  constructor(
    private dataService: DataService,
    private usuariosService: UsuariosService,
    public authService: AuthService,
    private ordenesServicio: OrdenesServicioService,
    private activatedRoute: ActivatedRoute,
    private alertService: AlertService,
    private ordenesServicioHistorialService: OrdenesServicioHistorialService,
    private ordenesServicioToTecnicosService: OrdenesServicioToTecnicosService,
    private router: Router,
    private location: Location
  ) { }

  ngOnInit() {
    this.dataService.ubicacionActual = 'Dashboard - Detalles de solicitud';
    this.alertService.loading();
    this.activatedRoute.params.subscribe(({ id }) => {
      this.idSolicitud = id;
      this.obtenerSolicitud();
    })
  }

  regresarRutaAnterior(): void {
    this.location.back();
  }

  calculoDemoraSolucion(): void {
    const fechaCierre = new Date(this.orden.fechaCierre);
    const fechaInicio = new Date(this.orden.createdAt);
    this.demoraSolucion = formatDistance(fechaCierre, fechaInicio, { locale: es });
    console.log(this.demoraSolucion);
  }

  obtenerSolicitud(): void {
    this.alertService.loading()
    this.ordenesServicio.getOrden(this.idSolicitud).subscribe({
      next: ({ orden }) => {
        console.log(orden);
        this.orden = orden;
        this.historialOrden = this.orden.ordenesServicioHistorial;
        this.calculoDemoraSolucion();
        this.tecnicosAsignados = [];
        orden.ordenesServicioTecnico.map(item => {
          item.activo ? this.tecnicosAsignados.push(item?.tecnico) : null;
        })
        console.log(this.tecnicosAsignados);
        this.alertService.close();
      }, error: ({ error }) => this.alertService.errorApi(error.message)
    })
  }

  abrirNoSolucionado(): void {
    this.motivoSinSolucion = '';
    this.showSinSolucion = true;
  }

  abrirSolucionado(): void {
    this.comentariosSolucion = '';
    this.showSolucionado = true;
  }

  abrirPendiente(): void {
    this.motivoPendiente = '';
    this.showPendiente = true;
  }

  solicitudSinSolucion(): void {

    // Se verifica que el motivo no esté vacío
    if (!this.motivoSinSolucion.trim()) {
      this.alertService.info('El motivo no puede estar vacío');
      return;
    }

    this.alertService.question({ msg: '¿Solicitud sin solución?', buttonText: 'Aceptar' })
      .then(({ isConfirmed }) => {
        if (isConfirmed) {

          this.alertService.loading();

          const dataSinSolucion = {
            fechaCierre: new Date().toISOString(),
            estadoOrden: 'Sin solucion',
            motivoSinSolucion: this.motivoSinSolucion,
            activo: false
          }

          // Rechazo de solicitud
          this.ordenesServicio.actualizarOrden(this.idSolicitud, dataSinSolucion).subscribe({
            next: () => {
              const dataHistorial = {
                tipo: 'Sin solucion',
                motivoSinSolucion: this.motivoSinSolucion,
                ordenServicioId: this.orden.id,
                creatorUserId: this.authService.usuario.userId,
              }
              // Actualizacion de historial
              this.ordenesServicioHistorialService.nuevaRelacion(dataHistorial).subscribe({
                next: () => {
                  this.alertService.close();
                  // this.router.navigateByUrl('/dashboard/ordenesServicio');
                  this.regresarRutaAnterior();
                }, error: ({ error }) => this.alertService.errorApi(error.message)
              });
            }, error: ({ error }) => this.alertService.errorApi(error.message)
          });

        }
      });

  }

  solicitudPendiente(): void {

    // Se verifica que el motivo no esté vacío
    if (!this.motivoPendiente.trim()) {
      this.alertService.info('El motivo no puede estar vacío');
      return;
    }

    this.alertService.question({ msg: '¿Solicitud pendiente?', buttonText: 'Aceptar' })
      .then(({ isConfirmed }) => {
        if (isConfirmed) {

          this.alertService.loading();

          const dataPendiente = {
            fechaPendiente:  new Date().toISOString(),
            estadoOrden: 'Pendiente',
            motivoPendiente: this.motivoPendiente,
            activo: true
          }

          // Solicitud pendiente
          this.ordenesServicio.actualizarOrden(this.idSolicitud, dataPendiente).subscribe({
            next: () => {
              const dataHistorial = {
                tipo: 'Pendiente',
                motivoPendiente: this.motivoPendiente,
                ordenServicioId: this.orden.id,
                creatorUserId: this.authService.usuario.userId,
              }
              // Actualizacion de historial
              this.ordenesServicioHistorialService.nuevaRelacion(dataHistorial).subscribe({
                next: () => {
                  this.alertService.close();
                  // this.router.navigateByUrl('/dashboard/ordenesServicio');
                  this.regresarRutaAnterior();
                }, error: ({ error }) => this.alertService.errorApi(error.message)
              });
            }, error: ({ error }) => this.alertService.errorApi(error.message)
          });

        }
      });

  }

  reactivarSolicitud(): void {
    this.alertService.question({ msg: '¿Quieres reactivar la solicitud?', buttonText: 'Aceptar' })
      .then(({ isConfirmed }) => {
        if (isConfirmed) {

          this.alertService.loading();

          const dataHistorial = {
            tipo: 'Reactivada',
            motivoSinSolucion: '',
            ordenServicioId: this.orden.id,
            creatorUserId: this.authService.usuario.userId,
            activo: true
          }

          // Actualizacion de historial
          this.ordenesServicioHistorialService.nuevaRelacion(dataHistorial).subscribe({
            next: () => {

              const dataReactivar = {
                fechaCierre: new Date().toISOString(),
                estadoOrden: 'Sin asignar',
                motivoSinSolucion: '',
                activo: true
              }

              // Reactivacion de solicitud
              this.ordenesServicio.actualizarOrden(this.idSolicitud, dataReactivar).subscribe({
                next: ({ orden }) => {
                  this.orden = orden;
                  this.alertService.close();
                }, error: ({ error }) => this.alertService.errorApi(error.message)
              });

            }, error: ({ error }) => this.alertService.errorApi(error.message)
          });
        }
      });
  }

  abrirAsignacion(): void {
    this.tecnicoSeleccionado = '';
    this.tecnicosParaAsignar = [];
    this.alertService.loading();
    this.usuariosService.listarUsuarios(
      1,
      'apellido',
      'true',
      'true',
      ''
    ).subscribe({
      next: ({ usuarios }) => {
        this.tecnicos = usuarios;
        this.showModalAsignacion = true;
        this.alertService.close();
      }, error: ({ error }) => this.alertService.errorApi(error.message)
    })
  }

  agregarTecnico(): void {
    if (!this.tecnicoSeleccionado) {
      this.alertService.info('Debes seleccionar un técnico');
      return;
    }
    const tecnico = this.tecnicos.find(t => t.id === this.tecnicoSeleccionado);
    this.tecnicosParaAsignar.push(tecnico);
    this.tecnicos = this.tecnicos.filter(t => t.id !== this.tecnicoSeleccionado);
    this.tecnicoSeleccionado = '';
  }

  eliminarTecnico(tecnicoId: string): void {
    const tecnico = this.tecnicosParaAsignar.find(t => t.id === tecnicoId);
    this.tecnicosParaAsignar = this.tecnicosParaAsignar.filter(t => t.id !== tecnicoId);
    this.tecnicos.push(tecnico);
  }

  asignarTecnicos(): void {

    if (this.tecnicosParaAsignar.length === 0) {
      this.alertService.info('Debes seleccionar al menos un técnico');
      return;
    }

    const data = {
      tecnicos: [],
      fechaEnProceso: new Date().toISOString(),
      ordenServicioId: this.idSolicitud,
      creatorUserId: this.authService.usuario.userId
    };

    this.tecnicosParaAsignar.forEach(t => data.tecnicos.push({ id: t.id }));

    this.alertService.question({ msg: '¿Quieres asignar el/los técnicos a la solicitud?', buttonText: 'Aceptar' })
      .then(({ isConfirmed }) => {
        if (isConfirmed) {
          this.alertService.loading();
          this.ordenesServicioToTecnicosService.nuevaOrdenTecnico(data).subscribe({
            next: () => {

              const dataHistorial = {
                tipo: 'En proceso',
                tecnicos: data.tecnicos,
                ordenServicioId: this.orden.id,
                creatorUserId: this.authService.usuario.userId,
              }

              // Actualizacion de historial
              this.ordenesServicioHistorialService.nuevaRelacion(dataHistorial).subscribe({
                next: () => {
                  this.alertService.close();
                  // this.router.navigateByUrl('/dashboard/ordenesServicio');
                  this.regresarRutaAnterior();
                }, error: ({ error }) => this.alertService.errorApi(error.message)
              });

            }, error: ({ error }) => this.alertService.errorApi(error.message)
          })
        }
      });
  }

  completarSolicitud(): void {

    if (!this.comentariosSolucion.trim()) {
      this.alertService.info('Debe describir la solución');
      return;
    }

    this.alertService.question({ msg: '¿Quieres completar la solicitud?', buttonText: 'Aceptar' })
      .then(({ isConfirmed }) => {
        if (isConfirmed) {
          this.alertService.loading();
          const data = {
            fechaCierre: new Date().toISOString(),
            comentariosSolucion: this.comentariosSolucion,
            estadoOrden: 'Completada',
            activo: false
          };
          this.ordenesServicio.actualizarOrden(this.idSolicitud, data).subscribe({
            next: () => {

              const dataHistorial = {
                tipo: 'Completada',
                ordenServicioId: this.orden.id,
                comentariosSolucion: this.comentariosSolucion,
                creatorUserId: this.authService.usuario.userId,
              }

              // Actualizacion de historial
              this.ordenesServicioHistorialService.nuevaRelacion(dataHistorial).subscribe({
                next: () => {
                  this.alertService.close();
                  // this.router.navigateByUrl('/dashboard/ordenesServicio');
                  this.regresarRutaAnterior();
                }, error: ({ error }) => this.alertService.errorApi(error.message)
              });

            }, error: ({ error }) => this.alertService.errorApi(error.message)
          })
        }
      });
  }

  cambiarSeccion(seccion: string): void {
    this.showSeccion = seccion;
  }

}
